import React, { Key, Suspense, useCallback, useEffect, useState } from "react";
import { useMutation, useRelayEnvironment } from "react-relay";
import {
  graphql,
  GraphQLSubscriptionConfig,
  PayloadError,
  requestSubscription,
} from "relay-runtime";

import { Card, Flex, View } from "@arizeai/components";

import { Loading } from "@phoenix/components";
import {
  ConnectedMarkdownBlock,
  ConnectedMarkdownModeRadioGroup,
  MarkdownDisplayProvider,
  useMarkdownMode,
} from "@phoenix/components/markdown";
import { useNotifyError } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import {
  ChatMessage,
  generateMessageId,
  PlaygroundInstance,
} from "@phoenix/store";
import { isStringKeyedObject } from "@phoenix/typeUtils";

import PlaygroundOutputMutation, {
  PlaygroundOutputMutation as PlaygroundOutputMutationType,
  PlaygroundOutputMutation$data,
} from "./__generated__/PlaygroundOutputMutation.graphql";
import {
  PlaygroundOutputSubscription as PlaygroundOutputSubscriptionType,
  PlaygroundOutputSubscription$data,
} from "./__generated__/PlaygroundOutputSubscription.graphql";
import PlaygroundOutputSubscription from "./__generated__/PlaygroundOutputSubscription.graphql";
import {
  PartialOutputToolCall,
  PlaygroundToolCall,
} from "./PlaygroundToolCall";
import { getChatCompletionInput, isChatMessages } from "./playgroundUtils";
import { RunMetadataFooter } from "./RunMetadataFooter";
import { TitleWithAlphabeticIndex } from "./TitleWithAlphabeticIndex";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundOutputProps extends PlaygroundInstanceProps {}

/**
 * A chat message with potentially partial tool calls, for when tool calls are being streamed back to the client
 */
type PlaygroundOutputMessage = Omit<ChatMessage, "toolCalls"> & {
  toolCalls?: ChatMessage["toolCalls"] | readonly PartialOutputToolCall[];
};

const getToolCallKey = (
  toolCall:
    | NonNullable<ChatMessage["toolCalls"]>[number]
    | PartialOutputToolCall[]
): Key => {
  if (
    isStringKeyedObject(toolCall) &&
    (typeof toolCall.id === "string" || typeof toolCall.id === "number")
  ) {
    return toolCall.id;
  }
  return JSON.stringify(toolCall);
};

function PlaygroundOutputMessage({
  message,
}: {
  message: PlaygroundOutputMessage;
}) {
  const { role, content, toolCalls } = message;
  const styles = useChatMessageStyles(role);
  const { mode: markdownMode } = useMarkdownMode();

  return (
    <Card
      title={role}
      {...styles}
      variant="compact"
      extra={<ConnectedMarkdownModeRadioGroup />}
    >
      {content != null && !Array.isArray(content) && (
        <Flex direction="column" alignItems="start">
          {markdownMode === "text" ? (
            content
          ) : (
            <View overflow="auto" maxWidth="100%">
              <ConnectedMarkdownBlock>{content}</ConnectedMarkdownBlock>
            </View>
          )}
        </Flex>
      )}
      {toolCalls && toolCalls.length > 0
        ? toolCalls.map((toolCall) => {
            return (
              <PlaygroundToolCall
                key={getToolCallKey(toolCall)}
                toolCall={toolCall}
              />
            );
          })
        : null}
    </Card>
  );
}

function PlaygroundOutputContent({
  content,
  partialToolCalls,
}: {
  content: OutputContent;
  partialToolCalls: readonly PartialOutputToolCall[];
}) {
  if (isChatMessages(content)) {
    return content.map((message, index) => {
      return <PlaygroundOutputMessage key={index} message={message} />;
    });
  }
  if (typeof content === "string" || partialToolCalls.length > 0) {
    return (
      <PlaygroundOutputMessage
        message={{
          id: generateMessageId(),
          content,
          role: "ai",
          toolCalls: partialToolCalls,
        }}
      />
    );
  }
  return "click run to see output";
}

type OutputContent = PlaygroundInstance["output"];

export function PlaygroundOutput(props: PlaygroundOutputProps) {
  const instanceId = props.playgroundInstanceId;
  const instances = usePlaygroundContext((state) => state.instances);
  const streaming = usePlaygroundContext((state) => state.streaming);
  const credentials = useCredentialsContext((state) => state);
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((instance) => instance.id === instanceId)
  );
  const instance = instances.find((instance) => instance.id === instanceId);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);

  const markPlaygroundInstanceComplete = usePlaygroundContext(
    (state) => state.markPlaygroundInstanceComplete
  );
  const environment = useRelayEnvironment();

  const playgroundStore = usePlaygroundStore();

  if (!instance) {
    throw new Error(`No instance found for id ${instanceId}`);
  }

  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }

  const [loading, setLoading] = useState(false);

  const [generateChatCompletion] = useMutation<PlaygroundOutputMutationType>(
    PlaygroundOutputMutation
  );

  const hasRunId = instance?.activeRunId != null;
  const notifyError = useNotifyError();

  const [outputContent, setOutputContent] = useState<OutputContent>(
    instance.output
  );
  const [toolCalls, setToolCalls] = useState<readonly PartialOutputToolCall[]>(
    []
  );

  const onNext = useCallback(
    ({ chatCompletion }: PlaygroundOutputSubscription$data) => {
      setLoading(false);
      if (chatCompletion.__typename === "TextChunk") {
        const content = chatCompletion.content;
        setOutputContent((prev) => {
          const newOutput = prev != null ? prev + content : content;
          return newOutput;
        });
        return;
      } else if (chatCompletion.__typename === "ToolCallChunk") {
        setToolCalls((toolCalls) => {
          let toolCallExists = false;
          const updated = toolCalls.map((toolCall) => {
            if (toolCall.id === chatCompletion.id) {
              toolCallExists = true;
              return {
                ...toolCall,
                function: {
                  ...toolCall.function,
                  arguments:
                    toolCall.function.arguments +
                    chatCompletion.function.arguments,
                },
              };
            } else {
              return toolCall;
            }
          });
          if (!toolCallExists) {
            updated.push({
              id: chatCompletion.id,
              function: {
                name: chatCompletion.function.name,
                arguments: chatCompletion.function.arguments,
              },
            });
          }
          return updated;
        });
        return;
      }
      if (
        chatCompletion.__typename === "ChatCompletionSubscriptionResult" &&
        chatCompletion.span != null
      ) {
        updateInstance({
          instanceId,
          patch: {
            spanId: chatCompletion.span.id,
          },
        });
        return;
      }
      if (chatCompletion.__typename === "ChatCompletionSubscriptionError") {
        markPlaygroundInstanceComplete(props.playgroundInstanceId);
        if (chatCompletion.message != null) {
          notifyError({
            title: "Chat completion failed",
            message: chatCompletion.message,
            expireMs: 10000,
          });
        }
      }
    },
    [
      instanceId,
      markPlaygroundInstanceComplete,
      notifyError,
      props.playgroundInstanceId,
      updateInstance,
    ]
  );

  const onCompleted = useCallback(
    (
      response: PlaygroundOutputMutation$data,
      errors: PayloadError[] | null
    ) => {
      setLoading(false);
      markPlaygroundInstanceComplete(props.playgroundInstanceId);
      updateInstance({
        instanceId,
        patch: {
          spanId: response.chatCompletion.span.id,
        },
      });
      if (errors) {
        notifyError({
          title: "Chat completion failed",
          message: errors[0].message,
        });
        return;
      }
      if (response.chatCompletion.errorMessage != null) {
        notifyError({
          title: "Chat completion failed",
          message: response.chatCompletion.errorMessage,
        });
        return;
      }
      setOutputContent(response.chatCompletion.content ?? undefined);
      setToolCalls(response.chatCompletion.toolCalls);
    },
    [
      instanceId,
      markPlaygroundInstanceComplete,
      notifyError,
      props.playgroundInstanceId,
      updateInstance,
    ]
  );

  useEffect(() => {
    if (!hasRunId) {
      return;
    }
    setLoading(true);
    setOutputContent(undefined);
    setToolCalls([]);
    const input = getChatCompletionInput({
      playgroundStore,
      instanceId,
      credentials,
    });

    if (streaming) {
      const config: GraphQLSubscriptionConfig<PlaygroundOutputSubscriptionType> =
        {
          subscription: PlaygroundOutputSubscription,
          variables: {
            input,
          },
          onNext: (response) => {
            if (response) {
              onNext(response);
            }
          },
          onCompleted: () => {
            setLoading(false);
            markPlaygroundInstanceComplete(props.playgroundInstanceId);
          },
          onError: (error) => {
            setLoading(false);
            // TODO(apowell): We should display this error to the user after formatting it nicely.
            // eslint-disable-next-line no-console
            console.error(error);
            markPlaygroundInstanceComplete(props.playgroundInstanceId);
            updateInstance({
              instanceId: props.playgroundInstanceId,
              patch: {
                activeRunId: null,
              },
            });
            notifyError({
              title: "Failed to get output",
              message: "Please try again.",
            });
          },
        };
      const subscription = requestSubscription(environment, config);
      return subscription.dispose;
    }
    generateChatCompletion({
      variables: {
        input,
      },
      onCompleted,
      onError(error) {
        setLoading(false);
        markPlaygroundInstanceComplete(props.playgroundInstanceId);
        notifyError({
          title: "Failed to get output",
          message: error.message,
        });
      },
    });
  }, [
    credentials,
    environment,
    generateChatCompletion,
    hasRunId,
    instanceId,
    markPlaygroundInstanceComplete,
    notifyError,
    onCompleted,
    onNext,
    playgroundStore,
    props.playgroundInstanceId,
    streaming,
    updateInstance,
  ]);

  return (
    <Card
      title={<TitleWithAlphabeticIndex index={index} title="Output" />}
      collapsible
      variant="compact"
      bodyStyle={{ padding: 0 }}
    >
      {loading ? (
        <View padding="size-200">
          <Loading message="Running..." />
        </View>
      ) : (
        <>
          <View padding="size-200">
            <MarkdownDisplayProvider>
              <PlaygroundOutputContent
                content={outputContent}
                partialToolCalls={toolCalls}
              />
            </MarkdownDisplayProvider>
          </View>
          <Suspense>
            {instance.spanId ? (
              <RunMetadataFooter spanId={instance.spanId} />
            ) : null}
          </Suspense>
        </>
      )}
    </Card>
  );
}

graphql`
  subscription PlaygroundOutputSubscription($input: ChatCompletionInput!) {
    chatCompletion(input: $input) {
      __typename
      ... on TextChunk {
        content
      }
      ... on ToolCallChunk {
        id
        function {
          name
          arguments
        }
      }
      ... on ChatCompletionSubscriptionResult {
        span {
          id
        }
      }
      ... on ChatCompletionSubscriptionError {
        message
      }
    }
  }
`;

graphql`
  mutation PlaygroundOutputMutation($input: ChatCompletionInput!) {
    chatCompletion(input: $input) {
      __typename
      content
      errorMessage
      span {
        id
      }
      toolCalls {
        id
        function {
          name
          arguments
        }
      }
    }
  }
`;
