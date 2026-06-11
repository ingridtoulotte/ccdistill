'use strict';

/**
 * Programmatic API. Everything the CLI can do is callable from Node:
 *
 *   const { scanAll, searchTranscripts, distill, auditContext } = require('teach2claude');
 */
module.exports = {
  ...require('./paths'),
  ...require('./transcript'),
  ...require('./tokens'),
  ...require('./search'),
  ...require('./distill'),
  ...require('./audit'),
  ...require('./args'),
};
