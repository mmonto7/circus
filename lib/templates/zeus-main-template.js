var Template = require('webpack/lib/Template'),

    Client = require('../client');


module.exports = MainTemplate;

function MainTemplate(outputOptions) {
  Template.call(this, outputOptions);
}
MainTemplate.prototype = Object.create(Template.prototype);
MainTemplate.prototype.apply = function(mainTemplate) {
  var includeCssLoader,
      includeJsLoader;

  mainTemplate.plugin('local-vars', function(source, chunk, hash) {
    var self = this,
        filename = this.outputOptions.filename || 'bundle.js',
        chunkFilename = this.outputOptions.chunkFilename || '[id].' + filename,

        cssChunkNames = [],
        jsChunkNames = [];

    if(chunk.chunks.length > 0) {
      source = this.asString([
        source,
        '',
        '// object to store loaded and loading chunks',
        '// "0" means "already loaded"',
        '// Array means "loading", array contains callbacks',
        'var installedChunks = {',
        this.indent(
          chunk.ids.map(function(id) {
            return id + ':0';
          }).join(',\n')
        ),
        '};'
      ]);
    }

    includeJsLoader = includeCssLoader = false;

    (function addChunk(c) {
      if (!c.entry) {
        jsChunkNames[c.id] = self.applyPluginsWaterfall('asset-path', chunkFilename, {
          hash: hash,
          chunk: {
            id: c.id,
            hash: c.renderedHash,
            name: c.name || c.id
          }
        });

        includeJsLoader = true;
      } else {
        jsChunkNames[c.id] = 0;
      }

      if (c.cssChunk) {
        cssChunkNames[c.id] = c.cssChunk.filename;
        includeCssLoader = true;
      }
      c.chunks.forEach(addChunk);
    }(chunk));

    if (includeJsLoader) {
      source = this.asString([
        source,
        'var jsPaths = ' + JSON.stringify(jsChunkNames) + ';'
      ]);
    }

    if (includeCssLoader) {
      source = this.asString([
        source,
        '// The css file cache',
        'var cssSheets = {};',
        'var cssPaths = ' + JSON.stringify(cssChunkNames.map(function(name) {
          return this.applyPluginsWaterfall('asset-path', name, {hash: hash});
        }, this)) + ';'
      ]);
    }

    return source;
  });
  mainTemplate.plugin('require-ensure', function(/* ensure, chunk, hash */) {
    return Client.jsLoader();
  });
  mainTemplate.plugin('bootstrap', function(source, chunk, hash) {
    if(chunk.chunks.length > 0) {
      var jsonpFunction = this.outputOptions.jsonpFunction || Template.toIdentifier('webpackJsonp' + (this.outputOptions.library || ''));
      return this.asString([
        source,
        '',
        Client.loaderCallback({
          jsonpFunction: JSON.stringify(jsonpFunction),
          requireFn: this.requireFn,
          addModules: this.renderAddModule(hash, chunk, 'moduleId', 'moreModules[moduleId]'),
          moreModules: this.entryPointInChildren(chunk)
        })
      ]);
    }
    return source;
  });
  mainTemplate.plugin('require-extensions', function(extensions/*, chunk, hash */) {
    var buf = [extensions];

    if (includeCssLoader) {
      buf.push(Client.cssLoader());
    }

    return this.asString(buf);
  });
};