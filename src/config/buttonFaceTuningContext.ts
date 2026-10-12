import { createContext, useContext } from 'react'
import buttonFaceTuning from './buttonFaceTuning.json'
import type { ButtonFaceTuningFile } from './buttonFaceTuning.ts'

export interface ButtonFaceTuningState {
  file: ButtonFaceTuningFile
}

export const ButtonFaceTuningContext = createContext<ButtonFaceTuningState>({ file: buttonFaceTuning })

export function useButtonFaceTuning(): ButtonFaceTuningState {
  return useContext(ButtonFaceTuningContext)
}
