import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'

// Run `npm run make` which calls `electron-vite build && electron-forge make`.
// electron-vite build outputs to out/ (main, preload, renderer).
// electron-forge then packages that output.

const config: ForgeConfig = {
  packagerConfig: {
    name: 'VideoEditorTool',
    executableName: 'video-editor-tool',
    icon: './resources/icons/icon',
    asar: true,
    // Ship resources/bin/ (bundled hf binary) as an extraResource
    extraResource: ['./resources/bin'],
    ignore: [
      /^\/src\//,
      /^\/\.vite\//,
      /tsconfig.*\.json$/,
      /electron\.vite\.config\.ts$/,
      /vite\.\w+\.config\.ts$/,
      /forge\.config\.ts$/,
      /^\/resources\//,
      /^\/\.claude\//,
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG(
      {
        name: 'VideoEditorTool',
        overwrite: true,
      },
      ['darwin']
    ),
    new MakerZIP({}, ['darwin']),
    new MakerSquirrel(
      {
        name: 'VideoEditorTool',
      },
      ['win32']
    ),
  ],
}

export default config
