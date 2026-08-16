// Config plugin that patches the iOS Podfile after expo prebuild generates it.
// @expo/config-plugins is required LAZILY (inside the plugin function, not at
// the top level) so that EAS can safely import this file before node_modules
// are fully installed — the IIFE approach fails at module-load time on the
// EAS worker because @expo/config-plugins isn't resolvable yet at that stage.
// Patches: (1) SPM nil-target guard (2) fmt consteval→constexpr (3) legacyResolver (8) SceneGeometry
// (4) modular headers (5) RNViewShot scroll (6) clerk-ios 1.3.6 (7) platform :ios 17.0
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = '# [SPMFix+FmtFix-v3+ExpoModulesFix-v1+ViewShotFix-v1+ClerkIosFix-v1] CocoaPods SPM/fmt/ExpoModules/ViewShot/ClerkIos compatibility patches (SDK 57)';
const MODULAR_HEADERS_MARKER = '# [ModularHeadersFix] AppCheckCore static-lib deps need module maps';

/**
 * Patch 1 – SPM nil-guard (CocoaPods 1.16.x / Xcode 26):
 *   SPM.apply_on_post_install crashes with nil target for ClerkGoogleSignIn.
 *   Fix: strip entries whose target doesn't exist before the call.
 *
 * Patch 2 – fmt consteval fix (Xcode 26.6 / Clang 19+):
 *   fmt 11.0.2 ships a hardcoded consteval ctor for FMT_STRING that isn't
 *   gated by FMT_USE_CONSTEVAL. Clang 19's stricter C++20 consteval rejects it.
 *   Fix: replace every `consteval` keyword in fmt sources with `constexpr`.
 *
 * Patch 3 – expo-modules-core 3.x API gap (affects expo-camera, expo-contacts,
 *   expo-location, expo-image-picker, expo-notifications, and any other Expo SDK
 *   module that still calls legacyResolver):
 *   (a) Promise.legacyResolver was removed in EMC 3.x (only legacyRejecter remains).
 *       Multiple SDK modules pass `resolve: promise.legacyResolver` to ObjC methods
 *       that expect EXPromiseResolveBlock = `@Sendable (Optional<Any>)->Void`.
 *       promise.legacyResolver no longer exists; promise.resolver is the wrong type
 *       (Promise.ResolveClosure = `(JavaScriptValue)->Void`).
 *       Fix: scan EVERY Swift file under node_modules and replace:
 *         `resolve: promise.legacyResolver,` → `resolve: { result in promise.resolve(result) },`
 *         `resolve: promise.legacyResolver)` → `resolve: { result in promise.resolve(result) })`
 *         `promise.legacyResolver(`          → `promise.resolve(`
 *   (b) EXPermissionsService.parsePermissionFromRequester: was removed from
 *       the public header. The implementation still exists in the .m file.
 *       Fix: re-add the declaration to EXPermissionsService.h before @end.
 *
 * Patch 4 (modular headers) – injected separately in JS below; not in PATCH_RUBY.
 *
 * Patch 5 – react-native-view-shot RCTScrollView removal (RN 0.76+):
 *   RCTScrollView was removed from React Native in 0.76. react-native-view-shot
 *   4.x still references it in the snapshotContentContainer code path of
 *   RNViewShot.mm, which causes a compile error even though that code path is
 *   never called by this app (captureRef is used without snapshotContentContainer).
 *   Fix: replace RCTScrollView references with UIScrollView equivalents.
 */
const PATCH_RUBY = `  ${PATCH_MARKER}
  # Patch 1: SPM nil-target guard
  if defined?(SPM) && SPM.respond_to?(:instance_variable_get)
    _spm_deps = SPM.instance_variable_get(:@dependencies_by_pod)
    if _spm_deps.is_a?(Hash)
      _project = installer.pods_project
      _spm_deps.delete_if do |_pod_name, _|
        _project.targets.none? { |t| t.name == _pod_name }
      end
    end
  end

  # Patch 2: Replace consteval with constexpr in all fmt pod sources/headers
  _fmt_dir = File.join(installer.sandbox.root.to_s, 'fmt')
  if Dir.exist?(_fmt_dir)
    _patched_files = []
    Dir.glob(File.join(_fmt_dir, '**', '*.{h,cc,cpp,inl}')).each do |_f|
      begin
        _content = File.read(_f, encoding: 'utf-8')
        if _content.include?('consteval')
          _new = _content.gsub(/\\bconsteval\\b/, 'constexpr')
          File.write(_f, _new, encoding: 'utf-8')
          _patched_files << File.basename(_f)
        end
      rescue => _e
        puts "[FmtFix] Skipped #{_f}: #{_e.message}"
      end
    end
    if _patched_files.empty?
      puts '[FmtFix] fmt sources: no consteval found'
    else
      puts "[FmtFix] Patched fmt files (consteval→constexpr): #{_patched_files.join(', ')}"
    end
  else
    puts "[FmtFix] Warning: fmt pod directory not found at #{_fmt_dir}"
  end

  # Patch 3: Fix expo-modules-core 3.x legacyResolver removal across ALL Expo SDK modules
  # Affected packages confirmed: expo-camera, expo-contacts, expo-location,
  #   expo-image-picker, expo-notifications (any .swift file under node_modules).
  _build_root = File.expand_path('../../', installer.sandbox.root.to_s)
  _node_modules = File.join(_build_root, 'node_modules')
  _legacy_patched = []
  _legacy_skipped = []

  # (a) Scan every Swift file under node_modules and replace legacyResolver
  if Dir.exist?(_node_modules)
    Dir.glob(File.join(_node_modules, '**', 'ios', '**', '*.swift')).each do |_f|
      begin
        _c = File.read(_f, encoding: 'utf-8')
        if _c.include?('legacyResolver')
          _n = _c
            .gsub('resolve: promise.legacyResolver,', 'resolve: { result in promise.resolve(result) },')
            .gsub('resolve: promise.legacyResolver)', 'resolve: { result in promise.resolve(result) })')
            .gsub('promise.legacyResolver(', 'promise.resolve(')
          if _c != _n
            File.write(_f, _n, encoding: 'utf-8')
            _legacy_patched << File.basename(_f)
          end
        end
      rescue => _e
        _legacy_skipped << "#{File.basename(_f)}: #{_e.message}"
      end
    end
  else
    puts "[ExpoModulesFix] Warning: node_modules not found at #{_node_modules}"
  end
  if _legacy_patched.empty?
    puts '[ExpoModulesFix] No legacyResolver occurrences found in any Swift file (already patched or API changed)'
  else
    puts "[ExpoModulesFix] Patched legacyResolver in: #{_legacy_patched.join(', ')}"
  end
  _legacy_skipped.each { |m| puts "[ExpoModulesFix] Skipped: #{m}" }

  # (b) EXPermissionsService.h: re-expose parsePermissionFromRequester: (removed from header in EMC 3.x)
  _emc_header = File.join(_build_root, 'node_modules', 'expo-modules-core',
                          'ios', 'Legacy', 'Services', 'Permissions', 'EXPermissionsService.h')
  if File.exist?(_emc_header)
    _content = File.read(_emc_header, encoding: 'utf-8')
    unless _content.include?('parsePermissionFromRequester:')
      _declaration = '+ (NSDictionary *)parsePermissionFromRequester:(NSDictionary *)permission;'
      _patched = _content.sub('@end', _declaration + "\\n\\n@end")
      File.write(_emc_header, _patched, encoding: 'utf-8')
      puts '[ExpoModulesFix] Re-exposed parsePermissionFromRequester: in EXPermissionsService.h'
    else
      puts '[ExpoModulesFix] EXPermissionsService.h: parsePermissionFromRequester already declared'
    end
  else
    puts "[ExpoModulesFix] Warning: EXPermissionsService.h not found at #{_emc_header}"
  end

  # Patch 5: react-native-view-shot -- replace RCTScrollView with UIScrollView (RN 0.76+ compat)
  # RCTScrollView was removed in RN 0.76. Strategy:
  #   1. Drop any #import line that references RCTScrollView (header no longer exists).
  #   2. Replace every remaining 'RCTScrollView' type name with 'UIScrollView' (string gsub,
  #      no regex -- catches declarations, class checks, casts, error strings, all at once).
  #   3. Fix the .scrollView accessor: the variable is now a UIScrollView directly.
  _rn_view_shot = File.join(_build_root, 'node_modules', 'react-native-view-shot',
                            'ios', 'RNViewShot.mm')
  if File.exist?(_rn_view_shot)
    _content = File.read(_rn_view_shot, encoding: 'utf-8')
    if _content.include?('RCTScrollView')
      _lines = _content.split($/)
      _lines.reject! { |l| l.include?('#import') && l.include?('RCTScrollView') }
      _patched = _lines.join($/)
      _patched = _patched + ($/) if _content.end_with?($/)
      _patched = _patched
        .gsub('RCTScrollView', 'UIScrollView')
        .gsub('rctScrollView.scrollView', 'rctScrollView')
      File.write(_rn_view_shot, _patched, encoding: 'utf-8')
      puts '[ViewShotFix] Patched RNViewShot.mm: RCTScrollView -> UIScrollView (RN 0.76+ compat)'
    else
      puts '[ViewShotFix] RNViewShot.mm: no RCTScrollView found (already patched or upstream changed)'
    end
  else
    puts '[ViewShotFix] Warning: RNViewShot.mm not found -- is react-native-view-shot installed?'
  end
`;

// Lazy loader: called inside the plugin function so it runs after npm install,
// not at module-import time. Tries the project's own node_modules first, then
// the EAS build-worker's copy as a fallback.
function loadWithDangerousMod() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', '@expo', 'config-plugins'),
    path.join(__dirname, '..', '..', '..', 'node_modules', '@expo', 'config-plugins'),
    path.join('/usr', 'local', 'eas-build-worker', 'node_modules', '@expo', 'config-plugins'),
    path.join('/usr', 'local', 'lib', 'node_modules', 'eas-cli', 'node_modules', '@expo', 'config-plugins'),
    '@expo/config-plugins',
  ];
  for (const p of candidates) {
    try { return require(p).withDangerousMod; } catch {}
  }
  throw new Error(
    '[withPodfileSpmFix] Cannot find @expo/config-plugins. ' +
    'Tried: ' + candidates.join(', ')
  );
}

const withPodfileSpmFix = (config) => {
  const withDangerousMod = loadWithDangerousMod();
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      if (!fs.existsSync(podfilePath)) {
        console.log('[withPodfileSpmFix] Podfile not found — skipping.');
        return config;
      }

      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Patch 7: Force CocoaPods platform :ios to '17.0' (ClerkExpo.podspec requires iOS 17.0).
      //
      // Root cause: the Expo SDK 57 / RN 0.86 generated Podfile contains:
      //   platform :ios, min_ios_version_supported
      // where min_ios_version_supported is a Ruby function defined in react_native_pods.rb that
      // returns Helpers::Constants.min_ios_version_supported — React Native's hardcoded floor (15.1).
      //
      // expo-build-properties.ios.deploymentTarget only modifies the Xcode pbxproj
      // (IPHONEOS_DEPLOYMENT_TARGET) and has NO effect on this Podfile platform line.
      //
      // CocoaPods silently excludes any pod whose s.platforms minimum exceeds the Podfile
      // platform :ios value. ClerkExpo.podspec declares s.platforms = { :ios => '17.0' },
      // so with platform :ios '15.1' CocoaPods silently drops ClerkExpo from the Pods project.
      // No pod target is created, no .swiftmodule is produced, and the main Owmo target fails
      // with "Unable to resolve module dependency: 'ClerkExpo'" at compile time.
      //
      // Fix: directly replace the platform line with '17.0' before pod install runs.
      // spm_dependency IS a global function (line 339 of react_native_pods.rb), so once
      // ClerkExpo is included, its podspec evaluates correctly and ClerkKit/ClerkKitUI
      // are registered as SPM dependencies and linked to the ClerkExpo Xcode target.
      {
        // Case A: standard Expo/RN Podfile uses function call form
        const PLATFORM_FUNC_RE = /^platform :ios, min_ios_version_supported\b[^\n]*/m;
        // Case B: literal version string (e.g. from older templates or prior patches)
        const PLATFORM_LIT_RE  = /^(platform :ios,\s*')([\d.]+)(')/m;
        let p7patched = false;

        if (PLATFORM_FUNC_RE.test(contents)) {
          contents = contents.replace(
            PLATFORM_FUNC_RE,
            "platform :ios, '17.0' # [Patch7] ClerkExpo requires iOS 17"
          );
          p7patched = true;
        } else {
          const litM = contents.match(PLATFORM_LIT_RE);
          if (litM && parseFloat(litM[2]) < 17.0) {
            contents = contents.replace(
              PLATFORM_LIT_RE,
              (_, p1, _v, p3) => `${p1}17.0${p3}`
            );
            p7patched = true;
          }
        }

        if (p7patched) {
          fs.writeFileSync(podfilePath, contents, 'utf8');
          console.log('[withPodfileSpmFix] Podfile: platform :ios → 17.0 (ClerkExpo requires iOS 17)');
        } else if (!contents.includes("platform :ios, '17.0'")) {
          console.warn('[withPodfileSpmFix] WARNING: could not locate platform :ios line — ClerkExpo may still be excluded!');
        } else {
          console.log('[withPodfileSpmFix] Podfile: platform :ios already at 17.0 — skipping.');
        }

        // Belt-and-suspenders: update Podfile.properties.json for templates that read from it.
        const podfilePropsPath = path.join(
          config.modRequest.platformProjectRoot,
          'Podfile.properties.json'
        );
        if (fs.existsSync(podfilePropsPath)) {
          try {
            const podfileProps = JSON.parse(fs.readFileSync(podfilePropsPath, 'utf8'));
            if (!podfileProps['ios.deploymentTarget'] ||
                parseFloat(podfileProps['ios.deploymentTarget']) < 17.0) {
              podfileProps['ios.deploymentTarget'] = '17.0';
              fs.writeFileSync(
                podfilePropsPath,
                JSON.stringify(podfileProps, null, 2) + '\n',
                'utf8'
              );
              console.log('[withPodfileSpmFix] Podfile.properties.json: ios.deploymentTarget → 17.0');
            }
          } catch (e) {
            console.warn('[withPodfileSpmFix] Could not patch Podfile.properties.json:', e.message);
          }
        }
      }

      // Patch 6: Bump clerk-ios from 1.3.2 → 1.3.6 in ClerkExpo.podspec.
      // clerk-ios 1.3.2 (used by @clerk/expo 3.7.8) does not build under Xcode 26 / Swift 6.
      // @clerk/expo 4.2.0 uses 1.3.6 which has the fix. We patch the podspec in-place
      // here (pre-pod-install) so CocoaPods resolves the correct version.
      const clerkPodspecPath = path.join(
        config.modRequest.projectRoot,
        'node_modules', '@clerk', 'expo', 'ios', 'ClerkExpo.podspec'
      );
      if (fs.existsSync(clerkPodspecPath)) {
        let podspec = fs.readFileSync(clerkPodspecPath, 'utf8');
        const OLD_CLERK_IOS = "clerk_ios_version = '1.3.2'";
        const NEW_CLERK_IOS = "clerk_ios_version = '1.3.6'";
        if (podspec.includes(OLD_CLERK_IOS)) {
          fs.writeFileSync(clerkPodspecPath, podspec.replace(OLD_CLERK_IOS, NEW_CLERK_IOS), 'utf8');
          console.log('[withPodfileSpmFix] ClerkExpo.podspec patched: clerk-ios 1.3.2 → 1.3.6');
        } else if (!podspec.includes(NEW_CLERK_IOS)) {
          // Log whatever version is there so we can debug
          const match = podspec.match(/clerk_ios_version = '[^']+'/);
          console.warn('[withPodfileSpmFix] ClerkExpo.podspec: unexpected clerk-ios version:', match ? match[0] : 'not found');
        } else {
          console.log('[withPodfileSpmFix] ClerkExpo.podspec: clerk-ios already at 1.3.6');
        }
      } else {
        console.warn('[withPodfileSpmFix] ClerkExpo.podspec not found at:', clerkPodspecPath);
      }

      // Patch 8: expo-store-review — SceneGeometry.foregroundScene() does not exist in
      // Xcode 26 SDK. Newer versions of the npm package shipped a broken API call.
      // Replace the function body with the correct UIApplication.shared.connectedScenes approach.
      const storeReviewPath = path.join(
        config.modRequest.projectRoot,
        'node_modules', 'expo-store-review', 'ios', 'StoreReviewModule.swift'
      );
      if (fs.existsSync(storeReviewPath)) {
        let srContent = fs.readFileSync(storeReviewPath, 'utf8');
        if (srContent.includes('SceneGeometry.foregroundScene()')) {
          srContent = srContent.replace(
            'return SceneGeometry.foregroundScene()',
            [
              '// First try to find a foreground active scene',
              '    if let activeScene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {',
              '      return activeScene',
              '    }',
              '    // If no foreground active scene is found, try foreground inactive',
              '    if let foregroundScene = UIApplication.shared.connectedScenes.first(where: {',
              '      $0.activationState == .foregroundInactive',
              '    }) as? UIWindowScene {',
              '      return foregroundScene',
              '    }',
              '    return nil',
            ].join('\n')
          );
          fs.writeFileSync(storeReviewPath, srContent, 'utf8');
          console.log('[withPodfileSpmFix] StoreReviewModule.swift patched: SceneGeometry → UIApplication.connectedScenes');
        } else {
          console.log('[withPodfileSpmFix] StoreReviewModule.swift: SceneGeometry already absent (up-to-date or already patched)');
        }
      } else {
        console.warn('[withPodfileSpmFix] StoreReviewModule.swift not found — skipping Patch 8');
      }

      // Patch 4: modular headers for AppCheckCore's non-modular static deps.
      // ClerkGoogleSignIn → GoogleSignIn → AppCheckCore (Swift pod) depends on
      // GoogleUtilities and RecaptchaInterop, which don't define modules.
      // CocoaPods refuses to integrate them as static libraries without
      // :modular_headers => true.
      if (!contents.includes(MODULAR_HEADERS_MARKER)) {
        const useExpoModulesIdx = contents.indexOf('use_expo_modules!');
        if (useExpoModulesIdx !== -1) {
          const lineEnd = contents.indexOf('\n', useExpoModulesIdx);
          const injection =
            `\n  ${MODULAR_HEADERS_MARKER}` +
            `\n  pod 'GoogleUtilities', :modular_headers => true` +
            `\n  pod 'RecaptchaInterop', :modular_headers => true`;
          contents =
            contents.slice(0, lineEnd) + injection + contents.slice(lineEnd);
          fs.writeFileSync(podfilePath, contents, 'utf8');
          console.log(
            '[withPodfileSpmFix] Podfile patched — modular headers for GoogleUtilities/RecaptchaInterop.'
          );
        } else {
          console.warn(
            '[withPodfileSpmFix] use_expo_modules! not found — skipping modular headers patch.'
          );
        }
      }

      if (contents.includes(PATCH_MARKER)) {
        console.log('[withPodfileSpmFix] Podfile already patched — skipping.');
        return config;
      }

      const TARGET = 'react_native_post_install(';
      const idx = contents.indexOf(TARGET);
      if (idx === -1) {
        console.warn(
          '[withPodfileSpmFix] react_native_post_install not found in Podfile — skipping.'
        );
        return config;
      }

      contents = contents.slice(0, idx) + PATCH_RUBY + '\n  ' + contents.slice(idx);
      fs.writeFileSync(podfilePath, contents, 'utf8');
      console.log(
        '[withPodfileSpmFix] Podfile patched — SPM nil-guard + fmt consteval + ExpoNotifications API fixes + ViewShot RCTScrollView fix.'
      );
      return config;
    },
  ]);
};

module.exports = withPodfileSpmFix;
