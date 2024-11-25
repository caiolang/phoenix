import { useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { Mutable } from "@phoenix/typeUtils";

import { ModelSupportedParamsFetcherQuery } from "./__generated__/ModelSupportedParamsFetcherQuery.graphql";

/**
 * Fetches the supported invocation parameters for a model and syncs them to the
 * playground store instance.
 */
export const ModelSupportedParamsFetcher = ({
  instanceId,
}: {
  instanceId: number;
}) => {
  const modelProvider = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)?.model
        .provider
  );
  const modelName = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)?.model
        .modelName
  );
  const updateModelSupportedInvocationParameters = usePlaygroundContext(
    (state) => state.updateModelSupportedInvocationParameters
  );
  const { modelInvocationParameters } =
    useLazyLoadQuery<ModelSupportedParamsFetcherQuery>(
      graphql`
        query ModelSupportedParamsFetcherQuery($input: ModelsInput!) {
          modelInvocationParameters(input: $input) {
            __typename
            ... on InvocationParameterBase {
              invocationName
              canonicalName
              required
            }
            # defaultValue must be aliased because Relay will not create a union type for fields with the same name
            # follow the naming convention of the field type e.g. floatDefaultValue for FloatInvocationParameter
            # default value mapping elsewhere in playground code relies on this naming convention
            # https://github.com/facebook/relay/issues/3776
            ... on BooleanInvocationParameter {
              booleanDefaultValue: defaultValue
              invocationInputField
            }
            ... on BoundedFloatInvocationParameter {
              floatDefaultValue: defaultValue
              invocationInputField
            }
            ... on FloatInvocationParameter {
              floatDefaultValue: defaultValue
              invocationInputField
            }
            ... on IntInvocationParameter {
              intDefaultValue: defaultValue
              invocationInputField
            }
            ... on JSONInvocationParameter {
              jsonDefaultValue: defaultValue
              invocationInputField
            }
            ... on StringInvocationParameter {
              stringDefaultValue: defaultValue
              invocationInputField
            }
            ... on StringListInvocationParameter {
              stringListDefaultValue: defaultValue
              invocationInputField
            }
          }
        }
      `,
      {
        input: {
          providerKey: modelProvider,
          modelName,
        },
      }
    );
  useEffect(() => {
    updateModelSupportedInvocationParameters({
      instanceId,
      supportedInvocationParameters: modelInvocationParameters as Mutable<
        typeof modelInvocationParameters
      >,
    });
  }, [
    modelInvocationParameters,
    instanceId,
    updateModelSupportedInvocationParameters,
  ]);
  return null;
};
