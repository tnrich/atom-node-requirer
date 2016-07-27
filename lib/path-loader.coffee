findNodeModules = require 'find-node-modules'
fs = require 'fs-plus'
{Task} = require 'atom'

module.exports =
  startTask: (callback) ->
    results = []
    taskPath = require.resolve('./load-paths-handler')
    followSymlinks = atom.config.get 'core.followSymlinks'
    ignoredNames = atom.config.get('fuzzy-finder.ignoredNames') ? []
    ignoredNames = ignoredNames.concat(atom.config.get('core.ignoredNames') ? [])
    ignoreVcsIgnores = atom.config.get('core.excludeVcsIgnoredPaths')
    projectPaths = atom.project.getPaths().map((path) -> fs.realpathSync(path))
    editor = atom.workspace.getActiveTextEditor()
    currentEditorPath = editor.getPath()
    # get all paths to node_modules folders above the current file path
    nodeModulesPaths = findNodeModules({ cwd: currentEditorPath, relative: false })
    # start a task (a separate node process so the UI isn't blocked)
    task = Task.once(
      taskPath,
      projectPaths,
      followSymlinks,
      ignoreVcsIgnores,
      nodeModulesPaths,
      ignoredNames, ->
        callback(results)
    )

    task.on 'load-paths:paths-found', (paths) ->
      results.push(paths...)

    task
