'use babel';
// var path = require('path')
// var dir = require('node-dir');

export default class NodeRequirerView {

  constructor(serializedState) {
    // var currentPath = atom.workspace.getActiveEditor().getPath()
    // var fpn = editor.getPath()
    // 
    // var lookup = position(src)
    // var dir = path.dirname(fpn)
    // var env = {}
    // 
    // env.__dirname  = dir
    // env.__filename = fpn
    

    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('node-requirer');

    // Create message element
    const message = document.createElement('div');
    message.textContent = 'The NodeRequirer package is Alive! It\'s ALIVE!';
    message.classList.add('message');
    this.element.appendChild(message);
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

}
