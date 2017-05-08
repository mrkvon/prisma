import {SystemEnvironment, Resolver} from '../types'
import {
  readProjectIdFromProjectFile,
  isValidProjectFilePath, writeProjectFile
} from '../utils/file'
import {
  noProjectIdMessage,
  cloningProjectMessage,
  noProjectFileOrIdMessage,
  invalidProjectFilePathMessage,
  multipleProjectFilesForCloneMessage,
  graphcoolProjectFileName, clonedProjectMessage
} from '../utils/constants'
import {
  parseErrors,
  generateErrorOutput,
  pullProjectInfo, cloneProject
} from '../api/api'
const debug = require('debug')('graphcool')

interface Props {
  sourceProjectId?: string
  projectFile?: string
  outputPath?: string
  name?: string
  includeMutationCallbacks?: boolean
  includeData?: boolean
}

export default async(props: Props, env: SystemEnvironment): Promise<void> => {
  const {resolver, out} = env

  try {

    const projectId = getProjectId(props, env)
    if (!projectId) {
      throw new Error(noProjectIdMessage)
    }

    out.startSpinner(cloningProjectMessage)

    const includeMutationCallbacks = props.includeMutationCallbacks !== undefined ? props.includeMutationCallbacks : true
    const includeData = props.includeData !== undefined ? props.includeData : true

    const clonedProjectName = await getClonedProjectName(props, projectId, resolver)
    const clonedProjectInfo = await cloneProject(projectId, clonedProjectName, includeMutationCallbacks, includeData, resolver)

    const outputPath = props.outputPath || `clone-${graphcoolProjectFileName}`
    writeProjectFile(clonedProjectInfo, resolver, outputPath)

    out.stopSpinner()
    const message = clonedProjectMessage(clonedProjectName, outputPath)
    out.write(message)


  } catch(e) {
    out.stopSpinner()
    if (e.errors) {
      const errors = parseErrors(e)
      const output = generateErrorOutput(errors)
      out.writeError(`${output}`)
    } else {
      throw e
    }

  }

}

async function getClonedProjectName(props: Props, projectId: string, resolver: Resolver): Promise<string> {
  if (props.name) {
    Promise.resolve(props.name)
  }

  const projectInfo = await pullProjectInfo(projectId, resolver)
  const clonedPojectName = `Clone of ${projectInfo.name}`
  return clonedPojectName
}

function getProjectFilePath(props: Props, env: SystemEnvironment): string {
  const {resolver, out} = env

  // check if provided file is valid (ends with correct suffix)
  if (props.projectFile && isValidProjectFilePath(props.projectFile)) {
    return props.projectFile
  } else if (props.projectFile && !isValidProjectFilePath(props.projectFile)) {
    throw new Error(invalidProjectFilePathMessage(props.projectFile))
  }

  // no project file provided, search for one in current dir
  const projectFiles = resolver.projectFiles('.')
  if (projectFiles.length === 0) {
    throw new Error(noProjectFileOrIdMessage)
  } else if (projectFiles.length > 1) {
    throw new Error(multipleProjectFilesForCloneMessage(projectFiles))
  }

  return projectFiles[0]
}

function getProjectId(props: Props, env: SystemEnvironment): string | undefined {
  if (props.sourceProjectId) {
    return props.sourceProjectId
  }

  const projectFile = getProjectFilePath(props, env)
  return readProjectIdFromProjectFile(env.resolver, projectFile)
}

