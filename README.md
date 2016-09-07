# node-requirer package

Node-requirer lets you quickly add require/import statements to any files/node_modules within your code!


![nodereqtake1](https://cloud.githubusercontent.com/assets/2730609/15100017/64f52e28-151b-11e6-8f4a-919456864341.gif)

Changelog:
0.1.6 - Added alias list. Fixed issue with requiring JSON files.
0.1.9 - Fixing node module subpath requires. Fixing same folder ./index.js requires.
0.1.10 - Fixing grave error caused by an erroneous = sign!
0.1.11 - Fixing minor error caused when prettifying path

Developing:
```
apm develop node-requirer
cd ~/github/node-requirer
atom -d .

update the changelog

git commit -a -m 'checking everything in'
apm publish --tag v0.1.11 patch
apm publish --tag v0.2.5 minor
apm publish --tag v1.0.0 major
```
Most of the final formatting occurs in the "openPath" method within fuzzy-finder-view.coffee.
