import { useQuery } from "@tanstack/react-query";
import { fetchStepDefinitionList, fetchStepSequenceList, fetchTaskSourceStepSequenceList } from "./stepSequence.client.js";

export const stepSequenceQueryKeys = {
  sequences: (loopId: string) => [`stepSequences`, loopId] as const,
  definitions: (loopId: string, stepSequenceId: string | null) => [`stepDefinitions`, loopId, stepSequenceId] as const,
  mappings: (loopId: string) => [`taskSourceStepSequences`, loopId] as const,
};

export const useStepSequenceList = (loopId: string) =>
  useQuery({
    queryKey: stepSequenceQueryKeys.sequences(loopId),
    queryFn: () => fetchStepSequenceList(loopId),
  });

export const useStepDefinitionList = (loopId: string, stepSequenceId: string | null) =>
  useQuery({
    queryKey: stepSequenceQueryKeys.definitions(loopId, stepSequenceId),
    queryFn: () => fetchStepDefinitionList(loopId, stepSequenceId as string),
    enabled: Boolean(stepSequenceId),
  });

export const useTaskSourceStepSequenceList = (loopId: string) =>
  useQuery({
    queryKey: stepSequenceQueryKeys.mappings(loopId),
    queryFn: () => fetchTaskSourceStepSequenceList(loopId),
  });
