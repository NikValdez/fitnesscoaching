import { ScratchEditor, type ScratchEditorProps } from './scratch-editor'

export function TodoEditor(props: ScratchEditorProps) {
  return (
    <ScratchEditor
      {...props}
      documentField="todo"
      label="Your to-do list"
      placeholder="Something to do… Press Enter to add the next task."
    />
  )
}
