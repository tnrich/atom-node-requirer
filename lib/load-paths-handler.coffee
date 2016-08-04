walkSync = require 'walk-sync'
async = require 'async'
fs = require 'fs'
path = require 'path'
atom = require 'atom'
_ = require 'underscore-plus'
{GitRepository} = require 'atom'
{Minimatch} = require 'minimatch'

PathsChunkSize = 100

emittedPaths = new Set

class PathLoader
  constructor: (@rootPath, ignoreVcsIgnores, @traverseSymlinkDirectories, @ignoredNames, @nodeModulesPaths) ->
    @paths = []
    @realPathCache = {}
    @repo = null
    if ignoreVcsIgnores
      repo = GitRepository.open(@rootPath, refreshOnWindowFocus: false)
      @repo = repo if repo?.relativize(path.join(@rootPath, 'test')) is 'test'

  load: (done) ->
    nativeNodeModules = ['assert', 'buffer', 'child_process', 'console', 'constants', 'crypto', 'cluster', 'dgram', 'dns', 'domain', 'events', 'freelist', 'fs', 'http', 'https', 'module', 'net', 'os', 'path', 'process', 'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'zlib']
    ignoredNamePatterns = @ignoredNames.map((ignoredName)->
      return ignoredName.pattern
    )
    ignoredNamePatterns.push('node_modules')
    
    @paths = @paths.concat(nativeNodeModules)
    for nodeModulePath in @nodeModulesPaths 
      nodeModules = fs.readdirSync(nodeModulePath)
      @paths = @paths.concat(nodeModules)
      for moduleName in nodeModules 
        try 
          subprojpath = path.join(nodeModulePath, moduleName)
          # subfiles = fs.readdirSync()
          subPaths = walkSync(subprojpath, { globs: ['**/*.js'], directories: false, ignore: ignoredNamePatterns})
          fullSubPaths = subPaths.map((subPath)->
            indexLocation = subPath.indexOf('index.js')
            if indexLocation != -1 
              subPath = subPath.slice(0, indexLocation)  
            return path.join(moduleName, subPath))
          @paths = @paths.concat(fullSubPaths)
        catch e
          console.warn(e)
    @loadPath @rootPath, true, =>
      @flushPaths()
      @repo?.destroy()
      done()

  isIgnored: (loadedPath) ->
    relativePath = path.relative(@rootPath, loadedPath)
    if @repo?.isPathIgnored(relativePath)
      true
    else
      for ignoredName in @ignoredNames
        return true if ignoredName.match(relativePath)

  pathLoaded: (loadedPath, done) ->
    unless @isIgnored(loadedPath) or emittedPaths.has(loadedPath)
      @paths.push(loadedPath)
      emittedPaths.add(loadedPath)

    if @paths.length is PathsChunkSize
      @flushPaths()
    done()

  flushPaths: ->
    emit('load-paths:paths-found', @paths)
    @paths = []

  loadPath: (pathToLoad, root, done) ->
    return done() if @isIgnored(pathToLoad) and not root
    fs.lstat pathToLoad, (error, stats) =>
      return done() if error?
      if stats.isSymbolicLink()
        @isInternalSymlink pathToLoad, (isInternal) =>
          return done() if isInternal
          fs.stat pathToLoad, (error, stats) =>
            return done() if error?
            if stats.isFile()
              @pathLoaded(pathToLoad, done)
            else if stats.isDirectory()
              if @traverseSymlinkDirectories
                @loadFolder(pathToLoad, done)
              else
                done()
            else
              done()
      else if stats.isDirectory()
        @loadFolder(pathToLoad, done)
      else if stats.isFile()
        @pathLoaded(pathToLoad, done)
      else
        done()

  loadFolder: (folderPath, done) ->
    fs.readdir folderPath, (error, children=[]) =>
      async.each(
        children,
        (childName, next) =>
          @loadPath(path.join(folderPath, childName), false, next)
        done
      )

  isInternalSymlink: (pathToLoad, done) ->
    fs.realpath pathToLoad, @realPathCache, (err, realPath) =>
      if err
        done(false)
      else
        done(realPath.search(@rootPath) is 0)

module.exports = (rootPaths, followSymlinks, ignoreVcsIgnores, nodeModulesPaths, ignores=[]) ->
  ignoredNames = []
  for ignore in ignores when ignore
    try
      ignoredNames.push(new Minimatch(ignore, matchBase: true, dot: true))
    catch error
      console.warn "Error parsing ignore pattern (#{ignore}): #{error.message}"
  
  async.each(
    rootPaths,
    (rootPath, next) ->
      new PathLoader(
        rootPath,
        ignoreVcsIgnores,
        followSymlinks,
        ignoredNames,
        nodeModulesPaths
      ).load(next)
    @async()
  )
