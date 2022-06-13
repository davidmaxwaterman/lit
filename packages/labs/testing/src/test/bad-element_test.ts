/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {ssrFixture} from '../fixtures.js';

import {html} from 'lit';
import {assert} from '@open-wc/testing';

suite(`bad-elements`, () => {
  test('fails with document.querySelectorAll', async () => {
    let err: Error | null = null;
    try {
      await ssrFixture(html`<bad-element-a></bad-element-a>`, {
        modules: ['./bad-element-a.js'],
      });
    } catch (error) {
      err = error as Error;
    }
    assert.match(
      err?.message ?? '',
      /document.querySelectorAll is not a function/
    );
  });
});
