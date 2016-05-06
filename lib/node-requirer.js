'use babel';

import NodeRequirerView from './node-requirer-view';
import { CompositeDisposable } from 'atom';
// import Filehound = from 'filehound';
// var dir = require('node-dir');
var Filehound = require('filehound');
window.Filehound = Filehound;

export default {

  nodeRequirerView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.nodeRequirerView = new NodeRequirerView(state.nodeRequirerViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.nodeRequirerView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'node-requirer:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.nodeRequirerView.destroy();
  },

  serialize() {
    return {
      nodeRequirerViewState: this.nodeRequirerView.serialize()
    };
  },

  toggle() {
    // console.log('NodeRequirer was toggled!');
    // console.log("Hey thomas!")
    Filehound.create()
      .paths(atom.project.getPaths()[0])
      // .match('Change')
      .addFilter(function (file) {
        console.log('file',JSON.stringify(file,null,4))
        return file.match(/a/)
      })
      .find(function (err, files) {
        console.log('err',err)
        console.log('files',files)
        debugger
      })
      
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
