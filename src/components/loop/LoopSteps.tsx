import { Button, Icon, MainTable, Notification, NotificationSeverity, Tooltip } from "@canonical/react-components";
import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { usePersonaList } from "@components/persona/persona.query.js";
import type { Persona } from "@components/persona/persona.schema.js";
import { useLoopProviderList } from "@components/provider/provider.query.js";
import type { LoopProvider } from "@components/provider/provider.schema.js";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useFormik } from "formik";
import { useState } from "react";
import { toFormikValidate } from "zod-formik-adapter";
import { createStepDefinition, deleteStepDefinition, deleteStepSequence, reorderStepDefinitions, updateStepDefinition, updateStepSequence } from "../stepSequence/stepSequence.client.js";
import { stepSequenceQueryKeys, useStepDefinitionList, useStepSequenceList } from "../stepSequence/stepSequence.query.js";
import type { StepDefinition, StepDefinitionWritable, StepSequence } from "../stepSequence/stepSequence.schema.js";
import { stepDefinitionWritableSchema } from "../stepSequence/stepSequence.schema.js";
import { LoopStepSequenceEditor, type StepSequenceEditor, type StepSequenceFormValues } from "./LoopStepSequenceEditor.js";
import type { LoopStepsProps } from "./loop.schema.js";

type DefinitionEditor = { mode: `create` } | { mode: `edit`; definition: StepDefinition };
type DefinitionFormValues = StepDefinitionWritable;

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === `string`) return error;
  if (typeof error === `number`) return error.toString();
  if (typeof error === `boolean`) return error ? `true` : `false`;
  try {
    return JSON.stringify(error) ?? `Unexpected error.`;
  } catch {
    return `Unexpected error.`;
  }
};

const reportError = (onFeedback: LoopStepsProps[`onFeedback`], title: string, error: unknown) => {
  onFeedback({ severity: NotificationSeverity.NEGATIVE, title, message: errorMessage(error) });
};

const definitionInitialValues = (editor: DefinitionEditor | null, definitions: StepDefinition[]): DefinitionFormValues => ({
  name: editor?.mode === `edit` ? editor.definition.name : ``,
  sequenceOrder: editor?.mode === `edit` ? editor.definition.sequenceOrder : definitions.length + 1,
  instructions: editor?.mode === `edit` ? editor.definition.instructions : ``,
  personaSelectionPolicy: editor?.mode === `edit` ? editor.definition.personaSelectionPolicy : `routingSelected`,
  persona: editor?.mode === `edit` ? editor.definition.persona : null,
  modelSelectionPolicy: editor?.mode === `edit` ? editor.definition.modelSelectionPolicy : `routingSelected`,
  modelProvider: editor?.mode === `edit` ? editor.definition.modelProvider : null,
  model: editor?.mode === `edit` ? editor.definition.model : null,
});

const showFieldError = (touched: boolean | undefined, error: string | undefined) => (touched && error ? <p className="p-form-validation is-error">{error}</p> : null);

const truncateInstructions = (instructions: string): string => {
  if (instructions.length <= 50) return instructions;
  return `${instructions.slice(0, 47)}...`;
};

const instructionCellContent = (instructions: string) => {
  if (instructions.length <= 50) return instructions;
  return (
    <Tooltip message={instructions}>
      <span>{truncateInstructions(instructions)}</span>
    </Tooltip>
  );
};

export function LoopSteps(props: Readonly<LoopStepsProps>) {
  const { loopId, stepSequenceId, onFeedback } = props;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const sequenceQuery = useStepSequenceList(loopId);
  const sequences = sequenceQuery.data ?? [];
  const selectedSequence = sequences.find((sequence) => sequence.id === stepSequenceId);
  const definitionsQuery = useStepDefinitionList(loopId, selectedSequence?.id ?? null);
  const definitions = definitionsQuery.data ?? [];
  const { state: personaListState } = usePersonaList(loopId);
  const { state: providerListState } = useLoopProviderList(loopId);
  const [sequenceEditor, setSequenceEditor] = useState<StepSequenceEditor | null>(null);
  const [definitionEditor, setDefinitionEditor] = useState<DefinitionEditor | null>(null);
  const [busyDefinitionId, setBusyDefinitionId] = useState<string | null>(null);
  const assignedPersonas = personaListState.status === `success` ? personaListState.personas : [];
  const assignedProviders = providerListState.status === `success` ? providerListState.providers : [];

  const saveSequence = async (values: StepSequenceFormValues, editor: StepSequenceEditor | null) => {
    if (editor?.mode !== `edit` || !selectedSequence) return;
    onFeedback(null);

    try {
      const saved = await updateStepSequence(loopId, selectedSequence.id, values);
      setSequenceEditor(null);
      await queryClient.invalidateQueries({ queryKey: stepSequenceQueryKeys.sequences(loopId) });
      onFeedback({ severity: NotificationSeverity.INFORMATION, title: `Sequence updated`, message: `${saved.name} has been saved.` });
    } catch (error) {
      reportError(onFeedback, `Unable to update sequence`, error);
    }
  };

  const removeSequence = async () => {
    if (!selectedSequence || !window.confirm(`Delete the "${selectedSequence.name}" sequence?`)) return;
    onFeedback(null);

    try {
      await deleteStepSequence(loopId, selectedSequence.id);
      await Promise.all([queryClient.invalidateQueries({ queryKey: stepSequenceQueryKeys.sequences(loopId) }), queryClient.invalidateQueries({ queryKey: stepSequenceQueryKeys.mappings(loopId) })]);
      onFeedback({ severity: NotificationSeverity.INFORMATION, title: `Sequence deleted`, message: `${selectedSequence.name} has been deleted.` });
      await navigate({ to: `/loop/$loopId/step-sequences`, params: { loopId } });
    } catch (error) {
      reportError(onFeedback, `Unable to delete sequence`, error);
    }
  };

  const saveDefinition = async (values: DefinitionFormValues, editor: DefinitionEditor | null) => {
    if (!editor || !selectedSequence) return;
    onFeedback(null);

    try {
      if (editor.mode === `edit`) {
        await updateStepDefinition(loopId, selectedSequence.id, editor.definition.id, values);
      } else {
        await createStepDefinition(loopId, selectedSequence.id, values);
      }

      setDefinitionEditor(null);
      await queryClient.invalidateQueries({ queryKey: stepSequenceQueryKeys.definitions(loopId, selectedSequence.id) });
      onFeedback({ severity: NotificationSeverity.INFORMATION, title: editor.mode === `edit` ? `Step updated` : `Step created`, message: `${values.name} has been saved.` });
    } catch (error) {
      reportError(onFeedback, editor.mode === `edit` ? `Unable to update step` : `Unable to create step`, error);
    }
  };

  const removeDefinition = async (definition: StepDefinition) => {
    if (!selectedSequence || !window.confirm(`Delete the "${definition.name}" step?`)) return;
    setBusyDefinitionId(definition.id);
    onFeedback(null);

    try {
      await deleteStepDefinition(loopId, selectedSequence.id, definition.id);
      await queryClient.invalidateQueries({ queryKey: stepSequenceQueryKeys.definitions(loopId, selectedSequence.id) });
      onFeedback({ severity: NotificationSeverity.INFORMATION, title: `Step deleted`, message: `${definition.name} has been deleted.` });
    } catch (error) {
      reportError(onFeedback, `Unable to delete step`, error);
    } finally {
      setBusyDefinitionId(null);
    }
  };

  const moveDefinition = async (definition: StepDefinition, offset: -1 | 1) => {
    if (!selectedSequence) return;
    const currentIndex = definitions.findIndex((item) => item.id === definition.id);
    const targetIndex = currentIndex + offset;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= definitions.length) return;

    const reordered = [...definitions];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    setBusyDefinitionId(definition.id);

    try {
      await reorderStepDefinitions(
        loopId,
        selectedSequence.id,
        reordered.map((item) => item.id),
      );
      await queryClient.invalidateQueries({ queryKey: stepSequenceQueryKeys.definitions(loopId, selectedSequence.id) });
    } catch (error) {
      reportError(onFeedback, `Unable to reorder steps`, error);
    } finally {
      setBusyDefinitionId(null);
    }
  };

  return (
    <>
      <SequenceSection
        error={sequenceQuery.isError ? errorMessage(sequenceQuery.error) : null}
        isLoading={sequenceQuery.isPending}
        onDelete={() => void removeSequence()}
        onEdit={() => selectedSequence && setSequenceEditor({ mode: `edit`, sequence: selectedSequence })}
        loopId={loopId}
        selectedSequence={selectedSequence}
      />
      {selectedSequence ? (
        <DefinitionSection
          busyDefinitionId={busyDefinitionId}
          definitions={definitions}
          error={definitionsQuery.isError ? errorMessage(definitionsQuery.error) : null}
          isLoading={definitionsQuery.isPending}
          onAdd={() => setDefinitionEditor({ mode: `create` })}
          onDelete={(definition) => void removeDefinition(definition)}
          onEdit={(definition) => setDefinitionEditor({ mode: `edit`, definition })}
          onMove={(definition, offset) => void moveDefinition(definition, offset)}
          personas={assignedPersonas}
          providers={assignedProviders}
          selectedSequence={selectedSequence}
        />
      ) : null}
      <LoopStepSequenceEditor editor={sequenceEditor} onClose={() => setSequenceEditor(null)} onSubmit={saveSequence} />
      <DefinitionEditorDrawer editor={definitionEditor} onClose={() => setDefinitionEditor(null)} onSubmit={saveDefinition} personas={assignedPersonas} providers={assignedProviders} definitions={definitions} />
    </>
  );
}

type SequenceSectionProps = {
  error: string | null;
  isLoading: boolean;
  onDelete: () => void;
  onEdit: () => void;
  loopId: string;
  selectedSequence: StepSequence | undefined;
};

function SequenceSection(props: Readonly<SequenceSectionProps>) {
  const { error, isLoading, onDelete, onEdit, loopId, selectedSequence } = props;

  return (
    <section>
      <p>
        <Link params={{ loopId }} to="/loop/$loopId/step-sequences">
          All step sequences
        </Link>
      </p>
      <div className="u-clearfix">
        <div className="u-float-left">
          <h2 className="p-heading--4">{selectedSequence?.name ?? `Step sequence`}</h2>
          {selectedSequence?.isDefault ? <p className="p-text--default">Default sequence</p> : null}
        </div>
        <div className="u-float-right">
          <Button appearance="base" disabled={!selectedSequence} onClick={onEdit} type="button">
            Edit sequence
          </Button>
          <Button appearance="base" aria-label="Delete sequence" disabled={!selectedSequence} onClick={onDelete} title="Delete sequence" type="button">
            <Icon aria-hidden="true" className="text-negative" name="delete" />
          </Button>
        </div>
      </div>
      <hr />
      {isLoading ? <p className="p-text--default">Loading step sequences...</p> : null}
      {error ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load step sequences">
          {error}
        </Notification>
      ) : null}
      {!isLoading && !error && !selectedSequence ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load step sequence">
          This sequence does not exist.
        </Notification>
      ) : null}
    </section>
  );
}

type DefinitionSectionProps = {
  busyDefinitionId: string | null;
  definitions: StepDefinition[];
  error: string | null;
  isLoading: boolean;
  onAdd: () => void;
  onDelete: (definition: StepDefinition) => void;
  onEdit: (definition: StepDefinition) => void;
  onMove: (definition: StepDefinition, offset: -1 | 1) => void;
  personas: Persona[];
  providers: LoopProvider[];
  selectedSequence: StepSequence;
};

function DefinitionSection(props: Readonly<DefinitionSectionProps>) {
  const { busyDefinitionId, definitions, error, isLoading, onAdd, onDelete, onEdit, onMove, personas, providers, selectedSequence } = props;

  return (
    <section>
      <div className="u-clearfix">
        <div className="u-float-left">
          <h2 className="p-heading--4">Step definitions</h2>
        </div>
        <div className="u-float-right">
          <Button appearance="positive" disabled={!selectedSequence} onClick={onAdd} type="button">
            Add step
          </Button>
        </div>
      </div>
      <hr />
      {isLoading ? <p className="p-text--default">Loading step definitions...</p> : null}
      {error ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load step definitions">
          {error}
        </Notification>
      ) : null}
      {!isLoading && !error && definitions.length === 0 ? <p className="p-text--default">No step definitions in this sequence.</p> : null}
      {!isLoading && !error && definitions.length > 0 ? (
        <MainTable
          className="u-table-layout--auto"
          headers={[{ content: `Order` }, { content: `Name` }, { content: `Instructions` }, { content: `Persona` }, { content: `Model` }, { content: `Actions`, className: `u-align--right` }]}
          rows={definitions.map((definition, index) => ({
            key: definition.id,
            columns: [
              { content: String(definition.sequenceOrder) },
              { content: definition.name },
              { content: instructionCellContent(definition.instructions) },
              { content: personaLabel(definition, personas) },
              { content: modelLabel(definition, providers) },
              { content: <DefinitionActions busy={busyDefinitionId !== null} definition={definition} index={index} total={definitions.length} onDelete={onDelete} onEdit={onEdit} onMove={onMove} /> },
            ],
          }))}
        />
      ) : null}
    </section>
  );
}

const personaLabel = (definition: StepDefinition, personas: Persona[]): string => {
  if (definition.personaSelectionPolicy === `routingSelected`) return `Selected by routing persona`;
  return personas.find((persona) => persona.id === definition.persona)?.displayName ?? `Preselected`;
};

const modelLabel = (definition: StepDefinition, providers: LoopProvider[]): string => {
  if (definition.modelSelectionPolicy === `routingSelected`) return `Selected by routing persona`;
  const providerName = providers.find((provider) => provider.provider === definition.modelProvider)?.displayName ?? `Provider`;
  return `${providerName} / ${definition.model}`;
};

type DefinitionActionsProps = {
  busy: boolean;
  definition: StepDefinition;
  index: number;
  total: number;
  onDelete: (definition: StepDefinition) => void;
  onEdit: (definition: StepDefinition) => void;
  onMove: (definition: StepDefinition, offset: -1 | 1) => void;
};

function DefinitionActions(props: Readonly<DefinitionActionsProps>) {
  const { busy, definition, index, total, onDelete, onEdit, onMove } = props;

  return (
    <div className="u-align--right">
      <Button appearance="base" aria-label={`Move ${definition.name} up`} disabled={index === 0 || busy} onClick={() => onMove(definition, -1)} type="button">
        Move up
      </Button>
      <Button appearance="base" aria-label={`Move ${definition.name} down`} disabled={index === total - 1 || busy} onClick={() => onMove(definition, 1)} type="button">
        Move down
      </Button>
      <Button appearance="base" aria-label={`Edit ${definition.name}`} onClick={() => onEdit(definition)} title={`Edit ${definition.name}`} type="button">
        Edit
      </Button>
      <Button appearance="base" aria-label={`Delete ${definition.name}`} disabled={busy} onClick={() => onDelete(definition)} title={`Delete ${definition.name}`} type="button">
        <Icon aria-hidden="true" className="text-negative" name="delete" />
      </Button>
    </div>
  );
}

type DefinitionEditorDrawerProps = {
  definitions: StepDefinition[];
  editor: DefinitionEditor | null;
  onClose: () => void;
  onSubmit: (values: DefinitionFormValues, editor: DefinitionEditor | null) => Promise<void>;
  personas: Persona[];
  providers: LoopProvider[];
};

function DefinitionEditorDrawer(props: Readonly<DefinitionEditorDrawerProps>) {
  const { definitions, editor, onClose, onSubmit, personas, providers } = props;
  const formik = useFormik<DefinitionFormValues>({
    enableReinitialize: true,
    initialValues: definitionInitialValues(editor, definitions),
    validate: toFormikValidate(stepDefinitionWritableSchema),
    onSubmit: (values) => onSubmit(values, editor),
  });
  const submitLabel = getSubmitLabel(formik.isSubmitting, editor?.mode === `edit`, `step`);

  const updatePersonaPolicy = (policy: DefinitionFormValues[`personaSelectionPolicy`]) => {
    void formik.setValues({ ...formik.values, personaSelectionPolicy: policy, persona: policy === `routingSelected` ? null : formik.values.persona });
  };

  const updateModelPolicy = (policy: DefinitionFormValues[`modelSelectionPolicy`]) => {
    void formik.setValues({
      ...formik.values,
      modelSelectionPolicy: policy,
      modelProvider: policy === `routingSelected` ? null : formik.values.modelProvider,
      model: policy === `routingSelected` ? null : formik.values.model,
    });
  };

  return (
    <EntityDrawer isOpen={editor !== null} onClose={onClose} size="large" title={editor?.mode === `edit` ? `Edit step` : `Create step`}>
      <form onSubmit={formik.handleSubmit}>
        <label htmlFor="step-definition-name">Step name</label>
        <input id="step-definition-name" name="name" onBlur={formik.handleBlur} onChange={formik.handleChange} required type="text" value={formik.values.name} />
        {showFieldError(formik.touched.name, formik.errors.name)}
        <label htmlFor="step-definition-instructions">Instructions</label>
        <textarea id="step-definition-instructions" name="instructions" onBlur={formik.handleBlur} onChange={formik.handleChange} required rows={5} value={formik.values.instructions} />
        {showFieldError(formik.touched.instructions, formik.errors.instructions)}
        <label htmlFor="step-definition-persona-policy">Persona selection</label>
        <select id="step-definition-persona-policy" onChange={(event) => updatePersonaPolicy(event.currentTarget.value as DefinitionFormValues[`personaSelectionPolicy`])} value={formik.values.personaSelectionPolicy}>
          <option value="routingSelected">Selected by routing persona</option>
          <option value="preSelected">Preselect a persona</option>
        </select>
        {formik.values.personaSelectionPolicy === `preSelected` ? <PersonaSelector formik={formik} personas={personas} /> : null}
        <label htmlFor="step-definition-model-policy">Model selection</label>
        <select id="step-definition-model-policy" onChange={(event) => updateModelPolicy(event.currentTarget.value as DefinitionFormValues[`modelSelectionPolicy`])} value={formik.values.modelSelectionPolicy}>
          <option value="routingSelected">Selected by routing persona</option>
          <option value="preSelected">Preselect a model</option>
        </select>
        {formik.values.modelSelectionPolicy === `preSelected` ? <ModelSelector formik={formik} providers={providers} /> : null}
        <div className="u-align--right">
          <Button appearance="base" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button appearance="positive" disabled={formik.isSubmitting} type="submit">
            {submitLabel}
          </Button>
        </div>
      </form>
    </EntityDrawer>
  );
}

const getSubmitLabel = (isSubmitting: boolean, isEditing: boolean, entity: `sequence` | `step`): string => {
  if (isSubmitting) return `Saving...`;
  if (isEditing) return `Save ${entity}`;
  return entity === `sequence` ? `Create sequence` : `Create step`;
};

type DefinitionFormik = ReturnType<typeof useFormik<DefinitionFormValues>>;

function PersonaSelector(props: Readonly<{ formik: DefinitionFormik; personas: Persona[] }>) {
  const { formik, personas } = props;

  return (
    <>
      <label htmlFor="step-definition-persona">Persona</label>
      <select id="step-definition-persona" onChange={(event) => void formik.setFieldValue(`persona`, event.currentTarget.value || null)} required value={formik.values.persona ?? ``}>
        <option value="">Select a persona</option>
        {personas.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.displayName}
          </option>
        ))}
      </select>
    </>
  );
}

function ModelSelector(props: Readonly<{ formik: DefinitionFormik; providers: LoopProvider[] }>) {
  const { formik, providers } = props;

  return (
    <>
      <label htmlFor="step-definition-provider">Provider</label>
      <select id="step-definition-provider" onChange={(event) => void formik.setFieldValue(`modelProvider`, event.currentTarget.value || null)} required value={formik.values.modelProvider ?? ``}>
        <option value="">Select a provider</option>
        {providers.map((provider) => (
          <option key={provider.provider} value={provider.provider}>
            {provider.displayName}
          </option>
        ))}
      </select>
      <label htmlFor="step-definition-model">Model</label>
      <input id="step-definition-model" onChange={(event) => void formik.setFieldValue(`model`, event.currentTarget.value || null)} required type="text" value={formik.values.model ?? ``} />
      {showFieldError(formik.touched.model, formik.errors.model)}
    </>
  );
}
