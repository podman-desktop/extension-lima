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

import { vi } from 'vitest';

export const configuration = {
  getConfiguration: vi.fn(),
};

export const provider = {
  createProvider: vi.fn(),
};

export const commands = {
  registerCommand: vi.fn(),
};

export const containerEngine = {
  saveImage: vi.fn(),
};

export const process = {
  exec: vi.fn(),
};

export const window = {
  withProgress: vi.fn(),
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
};

export const env = {
  isMac: false,
  isWindows: false,
};

export const ProgressLocation = {
  TASK_WIDGET: 'TASK_WIDGET',
};
