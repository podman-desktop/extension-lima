/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { builtinModules, Module } = require('node:module');
const path = require('node:path');
const { mock, test } = require('node:test');

// Test the exported OCI payload when CI supplies its extension directory.
const PROJECT_ROOT = process.env.LIMA_EXTENSION_ROOT || path.resolve(__dirname, '..');
const manifest = require(path.join(PROJECT_ROOT, 'package.json'));
const MAIN_PATH = path.resolve(PROJECT_ROOT, manifest.main);
const API_MODULE = '@podman-desktop/api';
const BUILTIN_MODULES = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
const LIMA_HOME = path.join(PROJECT_ROOT, 'test-lima-home');
const IMAGE_COMMAND = 'lima.image.move';

function loadBuild(settings = {}, existingPaths = []) {
  const disposable = { dispose: mock.fn() };
  const provider = {
    registerContainerProviderConnection: mock.fn(() => disposable),
    registerKubernetesProviderConnection: mock.fn(() => disposable),
    updateStatus: mock.fn(),
    dispose: mock.fn(),
  };
  const commands = new Map();
  const api = {
    configuration: {
      getConfiguration: () => ({
        get: (key) => settings[key] ?? manifest.contributes.configuration.properties[`lima.${key}`].default,
      }),
    },
    provider: { createProvider: mock.fn(() => provider) },
    commands: {
      registerCommand: (id, callback) => {
        commands.set(id, callback);
        return disposable;
      },
    },
    containerEngine: { saveImage: mock.fn(async () => {}) },
    process: { exec: mock.fn(async () => ({ stdout: '/tmp/lima-image' })) },
    env: { isMac: false, isWindows: false },
    ProgressLocation: { TASK_WIDGET: 'TASK_WIDGET' },
    window: {
      withProgress: async (_options, task) => task({ report: mock.fn() }),
      showInformationMessage: mock.fn(async () => {}),
      showErrorMessage: mock.fn(async () => {}),
    },
  };
  const mockedFs = {
    ...fs,
    existsSync: (filename) => existingPaths.includes(String(filename)),
    promises: { ...fs.promises, rm: mock.fn(async () => {}) },
  };

  // Load the bundle with only host APIs, as an installed extension without node_modules.
  const extension = new Module(MAIN_PATH);
  extension.filename = MAIN_PATH;
  extension.paths = [];
  extension.require = (id) => {
    if (id === API_MODULE) {
      return api;
    }

    assert.ok(BUILTIN_MODULES.has(id), `Unbundled runtime dependency: ${id}`);
    if (id === 'node:fs' || id === 'fs') {
      return mockedFs;
    }

    return require(id);
  };

  extension._compile(fs.readFileSync(MAIN_PATH, 'utf8'), MAIN_PATH);

  return { extension: extension.exports, api, provider, commands };
}

test('the manifest and provider assets exist in the extension', () => {
  assert.equal(`${manifest.publisher}.${manifest.name}`, 'podman-desktop.lima');

  for (const filename of [manifest.main, manifest.icon, 'logo-dark.png', 'logo-light.png', 'LICENSE', 'README.md']) {
    assert.ok(fs.existsSync(path.resolve(PROJECT_ROOT, filename)), `Missing extension asset: ${filename}`);
  }
});

test('the bundle activates without a Lima instance or external dependencies', async () => {
  const { extension, api } = loadBuild();
  const context = { subscriptions: [] };

  await extension.activate(context);
  extension.deactivate();

  assert.equal(context.subscriptions.length, 0);
  assert.equal(api.provider.createProvider.mock.callCount(), 0);
});

for (const type of ['podman', 'docker']) {
  test(`the bundle registers an existing ${type} instance`, async () => {
    const socketPath = path.join(LIMA_HOME, type, 'sock', `${type}.sock`);
    const { extension, provider } = loadBuild({ type, home: LIMA_HOME }, [socketPath]);
    const context = { subscriptions: [] };

    await extension.activate(context);

    const connection = provider.registerContainerProviderConnection.mock.calls[0].arguments[0];
    assert.equal(connection.type, type);
    assert.equal(connection.endpoint.socketPath, socketPath);
    assert.equal(connection.status(), 'started');
    assert.equal(context.subscriptions.length, 2);
  });
}

test('the bundled image dependency transfers an image to Kubernetes', async () => {
  const configPath = path.join(LIMA_HOME, 'kubernetes', 'copied-from-guest', 'kubeconfig.yaml');
  const { extension, api, provider, commands } = loadBuild({ type: 'kubernetes', home: LIMA_HOME }, [
    configPath,
  ]);

  await extension.activate({ subscriptions: [] });
  await commands.get(IMAGE_COMMAND)({ engineId: 'engine', name: 'example', tag: 'latest' });

  assert.equal(provider.registerKubernetesProviderConnection.mock.callCount(), 1);
  assert.equal(api.containerEngine.saveImage.mock.calls[0].arguments[1], 'example:latest');
  assert.equal(api.process.exec.mock.callCount(), 4);
  assert.equal(api.process.exec.mock.calls[0].arguments[0], 'limactl');
  assert.deepEqual(api.process.exec.mock.calls[2].arguments[1], [
    'shell',
    'kubernetes',
    'sudo',
    'ctr',
    '-n=k8s.io',
    'images',
    'import',
    '/tmp/lima-image',
  ]);
  assert.equal(api.window.showInformationMessage.mock.callCount(), 1);
});
