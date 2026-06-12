import { Button, MainTable, Notification, NotificationSeverity } from "@canonical/react-components";
import { type FormEvent, useState } from "react";
import { createProject, deleteProject, updateProject } from "./project.client.js";
import { useProjects } from "./project.query.js";
import type { Project as ProjectRecord } from "./project.schema.js";

type Feedback = {
  severity: NotificationSeverity;
  title: string;
  message: string;
};

const formatTimestamp = (value: Date | string) => new Date(value).toLocaleString();

export function Project() {
  const { state, reload } = useProjects();
  const [createName, setCreateName] = useState(``);
  const [createDescription, setCreateDescription] = useState(``);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [editName, setEditName] = useState(``);
  const [editDescription, setEditDescription] = useState(``);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const resetEditState = () => {
    setEditingProject(null);
    setEditName(``);
    setEditDescription(``);
    setIsSaving(false);
  };

  const startEditing = (project: ProjectRecord) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description ?? ``);
    setFeedback(null);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setFeedback(null);

    try {
      const project = await createProject({
        name: createName,
        description: createDescription,
      });

      setCreateName(``);
      setCreateDescription(``);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Project created`,
        message: `${project.name} is ready to use.`,
      });
      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to create project`,
        message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingProject) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const project = await updateProject(editingProject.id, {
        name: editName,
        description: editDescription,
      });

      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Project updated`,
        message: `${project.name} has been updated.`,
      });
      resetEditState();
      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to update project`,
        message,
      });
      setIsSaving(false);
    }
  };

  const handleDelete = async (project: ProjectRecord) => {
    setBusyProjectId(project.id);
    setFeedback(null);

    try {
      await deleteProject(project.id);
      setFeedback({
        severity: NotificationSeverity.INFORMATION,
        title: `Project deleted`,
        message: `${project.name} has been deleted.`,
      });

      if (editingProject?.id === project.id) {
        resetEditState();
      }

      reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFeedback({
        severity: NotificationSeverity.NEGATIVE,
        title: `Unable to delete project`,
        message,
      });
    } finally {
      setBusyProjectId(null);
    }
  };

  return (
    <section className="athena-home">
      <p className="p-heading--5">Projects</p>
      <h1 className="p-heading--2">Projects</h1>
      <p className="p-text--default">Create and manage the projects that own Athena loops.</p>
      {feedback ? (
        <Notification severity={feedback.severity} title={feedback.title}>
          {feedback.message}
        </Notification>
      ) : null}
      <div className="p-strip is-shallow">
        <form onSubmit={handleCreate}>
          <h2 className="p-heading--4">Create project</h2>
          <label htmlFor="create-project-name">Project name</label>
          <input id="create-project-name" name="create-project-name" onChange={(event) => setCreateName(event.target.value)} required type="text" value={createName} />
          <label htmlFor="create-project-description">Project description</label>
          <textarea id="create-project-description" name="create-project-description" onChange={(event) => setCreateDescription(event.target.value)} rows={3} value={createDescription} />
          <Button appearance="positive" disabled={isCreating} type="submit">
            {isCreating ? `Creating project...` : `Create project`}
          </Button>
        </form>
      </div>
      {editingProject ? (
        <div className="p-strip is-shallow">
          <form onSubmit={handleSave}>
            <h2 className="p-heading--4">Edit project</h2>
            <label htmlFor="edit-project-name">Project name</label>
            <input id="edit-project-name" name="edit-project-name" onChange={(event) => setEditName(event.target.value)} required type="text" value={editName} />
            <label htmlFor="edit-project-description">Project description</label>
            <textarea id="edit-project-description" name="edit-project-description" onChange={(event) => setEditDescription(event.target.value)} rows={3} value={editDescription} />
            <div>
              <Button appearance="positive" disabled={isSaving} type="submit">
                {isSaving ? `Saving project...` : `Save project`}
              </Button>
              <Button appearance="base" onClick={resetEditState} type="button">
                Cancel edit
              </Button>
            </div>
          </form>
        </div>
      ) : null}
      {state.status === `loading` ? <p className="p-text--default">Loading projects...</p> : null}
      {state.status === `error` ? (
        <Notification severity={NotificationSeverity.NEGATIVE} title="Unable to load projects">
          {state.message}
        </Notification>
      ) : null}
      {state.status === `success` && state.projects.length === 0 ? <p className="p-text--default">No projects yet. Create a project to start organizing loops.</p> : null}
      {state.status === `success` && state.projects.length > 0 ? (
        <MainTable
          headers={[{ content: "Name" }, { content: "Description" }, { content: "Updated at" }, { content: "Actions" }]}
          rows={state.projects.map((project) => ({
            key: project.id,
            columns: [
              { content: project.name },
              { content: project.description ?? "—" },
              { content: formatTimestamp(project.updatedAt) },
              {
                content: (
                  <div>
                    <Button appearance="base" onClick={() => startEditing(project)} type="button">
                      {`Edit ${project.name}`}
                    </Button>
                    <Button appearance="negative" disabled={busyProjectId === project.id} onClick={() => handleDelete(project)} type="button">
                      {busyProjectId === project.id ? `Deleting ${project.name}...` : `Delete ${project.name}`}
                    </Button>
                  </div>
                ),
              },
            ],
          }))}
        />
      ) : null}
    </section>
  );
}
