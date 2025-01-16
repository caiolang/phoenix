import React from "react";
import { graphql, useFragment } from "react-relay";

import { Card } from "@arizeai/components";

import { Flex, Text } from "@phoenix/components";
import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";
import { isTextPart } from "@phoenix/pages/playground/fetchPlaygroundPrompt";

import {
  PromptChatMessagesCard__main$data,
  PromptChatMessagesCard__main$key,
  PromptTemplateFormat,
} from "./__generated__/PromptChatMessagesCard__main.graphql";
import { ChatTemplateMessage } from "./ChatTemplateMessage";

const convertTemplateFormat = (
  templateFormat: PromptTemplateFormat
): TemplateLanguage => {
  if (templateFormat === "FSTRING") {
    return TemplateLanguages.FString;
  } else if (templateFormat === "MUSTACHE") {
    return TemplateLanguages.Mustache;
  }
  return TemplateLanguages.NONE;
};

export function PromptChatMessages({
  promptVersion,
}: {
  promptVersion: PromptChatMessagesCard__main$key;
}) {
  const { template, templateFormat } = useFragment(
    graphql`
      fragment PromptChatMessagesCard__main on PromptVersion {
        template {
          __typename
          ... on PromptChatTemplate {
            messages {
              role
              content {
                __typename
                ... on TextContentPart {
                  text {
                    text
                  }
                }
                ... on ImageContentPart {
                  image {
                    url
                  }
                }
                ... on ToolCallContentPart {
                  toolCall {
                    toolCallId
                  }
                }
                ... on ToolResultContentPart {
                  toolResult {
                    toolCallId
                    result
                  }
                }
              }
            }
          }
          ... on PromptStringTemplate {
            template
          }
        }
        templateType
        templateFormat
      }
    `,
    promptVersion
  );

  if (template.__typename === "PromptStringTemplate") {
    return <Text>{template.template}</Text>;
  }
  if (template.__typename === "PromptChatTemplate") {
    return (
      <ChatMessages
        template={template}
        templateFormat={convertTemplateFormat(templateFormat)}
      />
    );
  }
  if (template.__typename === "%other") {
    throw new Error("Unknown template type" + template.__typename);
  }
}

function ChatMessages({
  template,
  templateFormat,
}: {
  template: Extract<
    PromptChatMessagesCard__main$data["template"],
    { __typename: "PromptChatTemplate" }
  >;
  templateFormat: TemplateLanguage;
}) {
  const { messages } = template;
  return (
    <Flex direction="column" gap="size-200">
      {messages.map((message, i) => {
        const textPart = message.content.find(isTextPart);
        // TODO(apowell): Break out into switch statement, rendering each message part type
        if (!isTextPart(textPart)) {
          return null;
        }
        return (
          <ChatTemplateMessage
            key={i}
            role={message.role as string}
            content={textPart.text.text}
            templateFormat={templateFormat}
          />
        );
      })}
    </Flex>
  );
}

export function PromptChatMessagesCard({
  title = "Prompt",
  promptVersion,
}: {
  title?: string;
  promptVersion: PromptChatMessagesCard__main$key;
}) {
  return (
    <Card title={title} variant="compact">
      <PromptChatMessages promptVersion={promptVersion} />
    </Card>
  );
}
