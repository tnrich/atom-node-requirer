const upperCaseFirst = require('upper-case-first')
const pathExists = require('path-exists');
const camelcase = require('camelcase');
const moduleName = require('filename-to-module-name');
const path = require('path');
const relative = require('relative');
const { Point, CompositeDisposable } = require('atom');
const { $, $$, SelectListView } = require('atom-space-pen-views');
const { repositoryForPath } = require('./helpers');
const fs = require('fs-plus');
const fuzzaldrin = require('fuzzaldrin');
const fuzzaldrinPlus = require('fuzzaldrin-plus');


module.exports = class FuzzyFinderView extends SelectListView {
  constructor(){
    this.filePaths = null;
    this.projectRelativePaths = null;
    this.subscriptions = null;
    this.alternateScoring = false;
    this.useOldRequireSyntax = false;
  }

  initialize(paths, useOldRequireSyntax) {
    this.paths = paths;
    this.useOldRequireSyntax = useOldRequireSyntax;
    super.initialize();

    this.addClass('fuzzy-finder');
    this.setMaxItems(10);
    this.subscriptions = new CompositeDisposable();
    // 
    // splitLeft = => @splitOpenPath (pane) -> pane.splitLeft.bind(pane)
    // splitRight = => @splitOpenPath (pane) -> pane.splitRight.bind(pane)
    // splitUp = => @splitOpenPath (pane) -> pane.splitUp.bind(pane)
    // splitDown = => @splitOpenPath (pane) -> pane.splitDown.bind(pane)

    // atom.commands.add @element,
      // 'pane:split-left': splitLeft
      // 'pane:split-left-and-copy-active-item': splitLeft
      // 'pane:split-left-and-move-active-item': splitLeft
      // 'pane:split-right': splitRight
      // 'pane:split-right-and-copy-active-item': splitRight
      // 'pane:split-right-and-move-active-item': splitRight
      // 'pane:split-up': splitUp
      // 'pane:split-up-and-copy-active-item': splitUp
      // 'pane:split-up-and-move-active-item': splitUp
      // 'pane:split-down': splitDown
      // 'pane:split-down-and-copy-active-item': splitDown
      // 'pane:split-down-and-move-active-item': splitDown
      // 'fuzzy-finder:invert-confirm': =>
      //   @confirmInvertedSelection()

    this.alternateScoring = atom.config.get('fuzzy-finder.useAlternateScoring');
    return this.subscriptions.add(atom.config.onDidChange('fuzzy-finder.useAlternateScoring', ({newValue}) => this.alternateScoring = newValue));
  }

  openPath(filePath, lineNumber, openOptions) {
    let editor = atom.workspace.getActiveTextEditor();
    let currentEditorPath = editor.getPath();
    if (pathExists.sync(filePath)) {
      // the file is defined locally (not an npm module)
      var relativePath = relative(currentEditorPath, filePath);
      if (relativePath[0] !== '.') {
        relativePath = `./${relativePath}`;
      }
      if (relativePath.endsWith('/index.js')) {
        relativePath = relativePath.slice(0,-'/index.js'.length);
      }
      if (relativePath.endsWith('.js')) {
        relativePath = relativePath.slice(0,-'.js'.length);
      }
      var name = relativePath.slice(relativePath.lastIndexOf('/')+1);
      if (name.endsWith('.json')) {
        name = name.slice(0,-'.json'.length);
      }
      let first = string.charAt(0);
      let startsWithUpperCase = first === first.toUpperCase();
      name = camelcase(name);
      if (startsWithUpperCase)
        name = upperCaseFirst(name)
    } else { 
      // the path is actually just the name of an npm package
      var name = filePath;
      let aliasList = atom.config.get('node-requirer.aliasList');
      let aliases = {};
      try { 
        aliases = JSON.parse(aliasList);
      } catch (e) {
        atom.notifications.addError(`Error in node-requirer alias list. Make sure you are using valid :${e.toString()}`, {dismissable: true});
      }
        // console.log('aliases:',aliases)
      if (aliases[name]) {
        name = aliases[name];
      } else {
        name = camelcase(name);
      }
      
      var relativePath = filePath;
    }
    if (this.useOldRequireSyntax) {
      return editor.insertText(`var ${name} = require('${relativePath}')`);
    } else { 
      return editor.insertText(`import ${name} from '${relativePath}'`);
    }
  }
        
  getFilterKey() {
    return 'projectRelativePath';
  }

  cancel() {
    if (atom.config.get('fuzzy-finder.preserveLastSearch')) {
      let lastSearch = this.getFilterQuery();
      super.cancel();

      this.filterEditorView.setText(lastSearch);
      return this.filterEditorView.getModel().selectAll();
    } else {
      return super.cancel();
    }
  }

  destroy() {
    this.cancel();
    __guard__(this.panel, x => x.destroy());
    __guard__(this.subscriptions, x1 => x1.dispose());
    return this.subscriptions = null;
  }
    
  setUseOldRequireSyntax(val) {
    return this.useOldRequireSyntax = val;
  }
    
  viewForItem({filePath, projectRelativePath}) {
    // Style matched characters in search results
    let filterQuery = this.getFilterQuery();

    if (this.alternateScoring) {
      var matches = fuzzaldrinPlus.match(projectRelativePath, filterQuery);
    } else {
      var matches = fuzzaldrin.match(projectRelativePath, filterQuery);
    }

    return $$(function() {

      let highlighter = (path, matches, offsetIndex) => {
        let lastIndex = 0;
        let matchedChars = []; // Build up a set of matched chars to be more semantic

        for (let i = 0; i < matches.length; i++) {
          let matchIndex = matches[i];
          matchIndex -= offsetIndex;
          if (matchIndex < 0) { continue; } // If marking up the basename, omit path matches
          let unmatched = path.substring(lastIndex, matchIndex);
          if (unmatched) {
            if (matchedChars.length) { this.span(matchedChars.join(''), {class: 'character-match'}); }
            matchedChars = [];
            this.text(unmatched);
          }
          matchedChars.push(path[matchIndex]);
          lastIndex = matchIndex + 1;
        }

        if (matchedChars.length) { this.span(matchedChars.join(''), {class: 'character-match'}); }

        // Remaining characters are plain text
        return this.text(path.substring(lastIndex));
      };


      return this.li({class: 'two-lines'}, () => {
        let repo;
        if ((repo = repositoryForPath(filePath)) != null) {
          let id = encodeURIComponent(`fuzzy-finder-${filePath}`);
          this.div({class: 'status', id});
          repo.getCachedPathStatus(filePath).then(function(status) {
            let statusNode = $(document.getElementById(id));
            if ((statusNode != null) && repo.isStatusNew(status)) {
              return statusNode.addClass('status-added icon icon-diff-added');
            } else if ((statusNode != null) && repo.isStatusModified(status)) {
              return statusNode.addClass('status-modified icon icon-diff-modified');
            }
          });
        }

        let ext = path.extname(filePath);
        if (fs.isReadmePath(filePath)) {
          var typeClass = 'icon-book';
        } else if (fs.isCompressedExtension(ext)) {
          var typeClass = 'icon-file-zip';
        } else if (fs.isImageExtension(ext)) {
          var typeClass = 'icon-file-media';
        } else if (fs.isPdfExtension(ext)) {
          var typeClass = 'icon-file-pdf';
        } else if (fs.isBinaryExtension(ext)) {
          var typeClass = 'icon-file-binary';
        } else {
          var typeClass = 'icon-file-text';
        }

        let fileBasename = path.basename(filePath);
        let baseOffset = projectRelativePath.length - fileBasename.length;

        this.div({class: `primary-line file icon ${typeClass}`, 'data-name': fileBasename, 'data-path': projectRelativePath}, () => highlighter(fileBasename, matches, baseOffset));
        return this.div({class: 'secondary-line path no-icon'}, () => highlighter(projectRelativePath, matches, 0));
      }
      );
    });
  }


  moveToLine(lineNumber=-1) {
    let textEditor;
    if (lineNumber < 0) { return; }

    if (textEditor = atom.workspace.getActiveTextEditor()) {
      let position = new Point(lineNumber);
      textEditor.scrollToBufferPosition(position, {center: true});
      textEditor.setCursorBufferPosition(position);
      return textEditor.moveToFirstCharacterOfLine();
    }
  }
  // 
  // splitOpenPath: (splitFn) ->
  //   {filePath} = @getSelectedItem() ? {}
  //   lineNumber = @getLineNumber()
  // 
  //   if @isQueryALineJump() and editor = atom.workspace.getActiveTextEditor()
  //     pane = atom.workspace.getActivePane()
  //     splitFn(pane)(copyActiveItem: true)
  //     @moveToLine(lineNumber)
  //   else if not filePath
  //     return
  //   else if pane = atom.workspace.getActivePane()
  //     splitFn(pane)()
  //     @openPath(filePath, lineNumber)
  //   else
  //     @openPath(filePath, lineNumber)

  populateList() {
    if (this.isQueryALineJump()) {
      this.list.empty();
      return this.setError('Jump to line in active editor');
    } else if (this.alternateScoring) {
      return this.populateAlternateList();
    } else {
      return super.populateList();
    }
  }


  // Unfortunately  SelectListView do not allow inheritor to handle their own filtering.
  // That would be required to use external knowledge, for example: give a bonus to recent files.
  //
  // Or, in this case: test an alternate scoring algorithm.
  //
  // This is modified copy/paste from SelectListView#populateList, require jQuery!
  // Should be temporary

  populateAlternateList() {

    if (this.items == null) { return; }

    let filterQuery = this.getFilterQuery();
    if (filterQuery.length) {
      var filteredItems = fuzzaldrinPlus.filter(this.items, filterQuery, {key: this.getFilterKey()});
    } else {
      var filteredItems = this.items;
    }

    this.list.empty();
    if (filteredItems.length) {
      this.setError(null);

      let iterable = __range__(0, Math.min(filteredItems.length, this.maxItems), false);
      for (let j = 0; j < iterable.length; j++) {
        let i = iterable[j];
        let item = filteredItems[i];
        let itemView = $(this.viewForItem(item));
        itemView.data('select-list-item', item);
        this.list.append(itemView);
      }

      return this.selectItemView(this.list.find('li:first'));
    } else {
      return this.setError(this.getEmptyMessage(this.items.length, filteredItems.length));
    }
  }



  confirmSelection() {
    let item = this.getSelectedItem();
    return this.confirmed(item, {searchAllPanes: atom.config.get('fuzzy-finder.searchAllPanes')});
  }

  confirmInvertedSelection() {
    let item = this.getSelectedItem();
    return this.confirmed(item, {searchAllPanes: !atom.config.get('fuzzy-finder.searchAllPanes')});
  }

  confirmed({filePath}={}, openOptions) {
    if (atom.workspace.getActiveTextEditor() && this.isQueryALineJump()) {
      var lineNumber = this.getLineNumber();
      this.cancel();
      return this.moveToLine(lineNumber);
    } else if (!filePath) {
      return this.cancel();
    } else if (fs.isDirectorySync(filePath)) {
      this.setError('Selected path is a directory');
      return setTimeout((() => this.setError()), 2000);
    } else {
      var lineNumber = this.getLineNumber();
      this.cancel();
      return this.openPath(filePath, lineNumber, openOptions);
    }
  }

  isQueryALineJump() {
    let query = this.filterEditorView.getModel().getText();
    let colon = query.indexOf(':');
    let trimmedPath = this.getFilterQuery().trim();

    return trimmedPath === '' && colon !== -1;
  }

  getFilterQuery() {
    let query = super.getFilterQuery();
    let colon = query.indexOf(':');
    if (colon !== -1) { query = query.slice(0, colon); }
    // Normalize to backslashes on Windows
    if (process.platform === 'win32') { query = query.replace(/\//g, '\\'); }
    return query;
  }

  getLineNumber() {
    let query = this.filterEditorView.getText();
    let colon = query.indexOf(':');
    if (colon === -1) {
      return -1;
    } else {
      return parseInt(query.slice(colon+1)) - 1;
    }
  }

  setItems(filePaths) {
    return super.setItems(this.projectRelativePathsForFilePaths(filePaths));
  }

  projectRelativePathsForFilePaths(filePaths) {
    // Don't regenerate project relative paths unless the file paths have changed
    if (filePaths !== this.filePaths) {
      let projectHasMultipleDirectories = atom.project.getDirectories().length > 1;

      this.filePaths = filePaths;
      this.projectRelativePaths = this.filePaths.map(function(filePath) {
        let [rootPath, projectRelativePath] = atom.project.relativizePath(filePath);
        if (rootPath && projectHasMultipleDirectories) {
          projectRelativePath = path.join(path.basename(rootPath), projectRelativePath);
        }
        return {filePath, projectRelativePath};});
    }

    return this.projectRelativePaths;
  }

  show() {
    this.storeFocusedElement();
    if (this.panel == null) { this.panel = atom.workspace.addModalPanel({item: this}); }
    this.panel.show();
    return this.focusFilterEditor();
  }

  hide() {
    return __guard__(this.panel, x => x.hide());
  }

  cancelled() {
    return this.hide();
  }
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}
