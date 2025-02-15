/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

// import * as ReactModule from 'react';
import 'react/umd/react.development.js';
import 'react-dom/umd/react-dom.development.js';
import {useController} from '../use-controller.js';
import {assert} from '@esm-bundle/chai';
import {
  ReactiveController,
  ReactiveControllerHost,
} from '@lit/reactive-element';

const {React, ReactDOM} = window;

suite('useController', () => {
  let container: HTMLElement;
  let ctorCallCount = 0;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    ctorCallCount = 0;
  });

  teardown(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  class TestController implements ReactiveController {
    host: ReactiveControllerHost;
    a: string;

    log: Array<string> = [];

    constructor(host: ReactiveControllerHost, a: string) {
      this.host = host;
      this.a = a;
      host.addController(this);
      ctorCallCount++;
    }

    hostConnected() {
      this.log.push('connected');
    }

    hostDisconnected() {
      this.log.push('disconnected');
    }

    hostUpdate() {
      this.log.push('update');
    }

    hostUpdated() {
      this.log.push('updated');
    }
  }

  const useTest = (a: string) => {
    return useController(
      React,
      (host: ReactiveControllerHost) => new TestController(host, a)
    );
  };

  const lifeCycleTest = ({strict}: {strict: boolean}) => {
    test(`basic lifecycle${strict ? ' - strict mode' : ''}`, () => {
      let testController!: TestController;

      let componentRenderLog: string[] = [];
      let componentLayoutEffectLog: string[] = [];

      const TestComponent = ({x}: {x: number}) => {
        testController = useTest('a');
        // Record the state of the testController's log when the component
        // runs. It should have at least run `connect + update` by now.
        componentRenderLog = [...testController.log];
        React.useLayoutEffect(() => {
          // Record the state of the testController's log when the component
          // runs. It should have completed an update by now.
          componentLayoutEffectLog = [...testController.log];
        });
        return React.createElement('div', {className: 'foo'}, [
          `x:${x}, a:${testController.a}`,
        ]);
      };

      const render = (props: any) => {
        const component = React.createElement(TestComponent, props);
        ReactDOM.render(
          strict
            ? React.createElement(React.StrictMode, {}, component)
            : component,
          container
        );
      };

      render({x: 1});
      // Note, strict mode 2x renders
      const expectedCtorCallCount = strict ? 2 : 1;
      // TODO(sorvell): in strict mode, this would be more correct if it were
      // ['update', 'updated', 'update'] since that would indicate the first
      // strict mode render was properly balanced, but React does
      // "2x render then effects" in strict mode so this would require
      // explicitly detecting this case. Ignoring for now since relying on this
      // seems like a corner case.
      const expectedNonInitialRenderUpdates = strict
        ? ['update', 'update']
        : ['update'];
      //
      assert.equal(ctorCallCount, expectedCtorCallCount);
      assert.equal(container.innerHTML, `<div class="foo">x:1, a:a</div>`);
      // Tests the state of the controllerLog in the component's render.
      // We expect the controller to have run `connected + update` when
      // `useController` returns in the component.
      assert.deepEqual(componentRenderLog, ['connected', 'update']);
      assert.deepEqual(testController.log, ['connected', 'update', 'updated']);
      // Tests the state of the controllerLog in a `useLayoutEffect` callback
      // used in the component. We expect the controller to have completed
      // an update by then.
      assert.deepEqual(componentLayoutEffectLog, testController.log);
      const firstTestController = testController;
      componentRenderLog.length =
        componentLayoutEffectLog.length =
        testController.log.length =
          0;
      render({x: 2});
      assert.equal(ctorCallCount, expectedCtorCallCount);
      assert.equal(container.innerHTML, `<div class="foo">x:2, a:a</div>`);
      assert.deepEqual(componentRenderLog, expectedNonInitialRenderUpdates);
      assert.deepEqual(testController.log, [
        ...expectedNonInitialRenderUpdates,
        'updated',
      ]);
      assert.deepEqual(componentLayoutEffectLog, testController.log);
      assert.strictEqual(testController, firstTestController);
    });
  };

  lifeCycleTest({strict: false});
  lifeCycleTest({strict: true});

  test('requestUpdate', async () => {
    let testController!: TestController;

    const TestComponent = ({x}: {x: number}) => {
      testController = useTest('a');
      return React.createElement('div', {className: 'foo'}, [
        `x:${x}, a:${testController.a}`,
      ]);
    };

    const render = (props: any) => {
      ReactDOM.render(React.createElement(TestComponent, props), container);
    };

    // Initial render
    render({x: 1});
    assert.deepEqual(testController.log, ['connected', 'update', 'updated']);

    // Update 1
    testController.log.length = 0;
    testController.a = 'b';
    testController.host.requestUpdate();

    await new Promise((r) => setTimeout(r, 0));

    assert.equal(container.innerHTML, `<div class="foo">x:1, a:b</div>`);
    assert.deepEqual(testController.log, ['update', 'updated']);

    // Update 2
    testController.log.length = 0;
    testController.a = 'c';
    testController.host.requestUpdate();

    await new Promise((r) => setTimeout(r, 0));

    assert.equal(container.innerHTML, `<div class="foo">x:1, a:c</div>`);
    assert.deepEqual(testController.log, ['update', 'updated']);
  });

  test('disconnect', () => {
    let testController!: TestController;

    const TestComponent = ({x}: {x: number}) => {
      testController = useTest('a');
      return React.createElement('div', {className: 'foo'}, [
        `x:${x}, a:${testController.a}`,
      ]);
    };

    ReactDOM.render(React.createElement(TestComponent, {x: 1}), container);
    assert.deepEqual(testController.log, ['connected', 'update', 'updated']);
    testController.log.length = 0;

    ReactDOM.render(React.createElement('div'), container);
    assert.equal(container.innerHTML, `<div></div>`);
    assert.deepEqual(testController.log, ['disconnected']);
  });

  test('updateComplete', async () => {
    let testController!: TestController;
    let updateCompleteCount = 0;
    let lastNestedUpdate: boolean | undefined;
    let rerender = false;

    const TestComponent = ({x}: {x: number}) => {
      testController = useTest('a');
      testController.host.updateComplete.then((nestedUpdate) => {
        updateCompleteCount++;
        lastNestedUpdate = nestedUpdate;
      });
      if (rerender) {
        // prevent an infinite loop
        rerender = false;
        testController.host.requestUpdate();
      }
      return React.createElement('div', {className: 'foo'}, [
        `x:${x}, a:${testController.a}`,
      ]);
    };

    const render = (props: any) => {
      ReactDOM.render(React.createElement(TestComponent, props), container);
    };

    render({x: 1});
    assert.deepEqual(testController.log, ['connected', 'update', 'updated']);
    testController.log.length = 0;
    await 0;
    assert.equal(updateCompleteCount, 1);
    assert.strictEqual(lastNestedUpdate, false);

    // cause a requestUpdate() during render
    rerender = true;
    render({x: 2});
    await 0;
    // Expect only one more renders since requestUpdate() is called
    // during render
    assert.equal(updateCompleteCount, 2);
    assert.strictEqual(lastNestedUpdate, false);

    await 0;

    assert.equal(updateCompleteCount, 2);
  });
});
