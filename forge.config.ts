import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { VitePlugin } from '@electron-forge/plugin-vite'
import type { ForgeConfig } from '@electron-forge/shared-types'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

const config: ForgeConfig = {
	packagerConfig: {
		asar: true,
		ignore: (file: string): boolean => {
			if (!file) {
				return false
			}

			const bundledNodeModules = [
				'/node_modules/better-sqlite3/',
				'/node_modules/bindings/',
				'/node_modules/file-uri-to-path/',
			]

			const shouldKeep =
				file.startsWith('/.vite') ||
				file === '/node_modules' ||
				bundledNodeModules.some((modulePath) => file.startsWith(modulePath))

			return !shouldKeep
		},
		icon: 'assets/icon',
		executableName: 'speichr',
		appBundleId: 'com.speichr.app',
		appCategoryType: 'public.app-category.developer-tools',
		win32metadata: {
			CompanyName: 'Speichr',
			FileDescription: 'Speichr desktop application',
			OriginalFilename: 'Speichr.exe',
			ProductName: 'Speichr',
		},
	},
	rebuildConfig: {},
	makers: [
		new MakerSquirrel({}, ['win32']),
		new MakerZIP({}, ['darwin', 'linux']),
		new MakerDeb(
			{
				options: {
					maintainer: 'jeheskielSunloy77 <jeheskielventiokysunloy@gmail.com>',
					homepage: 'https://github.com/jeheskielSunloy77/speichr',
					icon: 'assets/icon.png',
					categories: ['Development', 'Utility'],
					synopsis:
						'Desktop operations studio for cache workflows and observability',
					description:
						'Speichr is an Electron desktop app for managing cache connections, key workflows, observability, and incident exports.',
				},
			},
			['linux'],
		),
	],
	plugins: [
		new AutoUnpackNativesPlugin({}),
		new VitePlugin({
			// `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
			// If you are familiar with Vite configuration, it will look really familiar.
			build: [
				{
					// `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
					entry: 'src/main/main.ts',
					config: 'vite.main.config.ts',
					target: 'main',
				},
				{
					entry: 'src/preload/preload.ts',
					config: 'vite.preload.config.ts',
					target: 'preload',
				},
			],
			renderer: [
				{
					name: 'main_window',
					config: 'vite.renderer.config.ts',
				},
			],
		}),
		// Fuses are used to enable/disable various Electron functionality
		// at package time, before code signing the application
		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: true,
		}),
	],
}

export default config
