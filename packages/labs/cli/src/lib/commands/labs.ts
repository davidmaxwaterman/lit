/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {Command} from '../command.js';
import {LitCli} from '../lit-cli.js';

export const makeLabsCommand = (cli: LitCli): Command => {
  return {
    kind: 'resolved',
    name: 'labs',
    description: 'Experimental commands',
    subcommands: [
      {
        kind: 'resolved',
        name: 'gen',
        description: 'Generate framework wrappers',
        options: [
          {
            name: 'package',
            multiple: true,
            defaultValue: './',
            description:
              'Folder containing a package to generate wrappers for.',
          },
          {
            name: 'framework',
            multiple: true,
            description:
              'Framework to generate wrappers for. Supported frameworks: react.',
          },
          {
            name: 'out',
            defaultValue: './gen',
            description: 'Folder to output generated packages to.',
          },
        ],
        async run(
          {
            package: packages,
            framework: frameworks,
            out: outDir,
          }: {
            package: string[];
            framework: string[];
            out: string;
          },
          console: Console
        ) {
          const gen = await import('../generate/generate.js');
          await gen.run({cli, packages, frameworks, outDir}, console);
        },
      },
    ],
    async run() {
      console.error(
        'Use one of the labs subcommands, like `lit gen`. ' +
          'Run `lit help gen` for more help.'
      );
    },
  };
};
