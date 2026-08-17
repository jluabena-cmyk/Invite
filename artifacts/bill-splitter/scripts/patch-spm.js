#!/usr/bin/env node
/**
 * Patches react-native's spm.rb to add a nil-guard around the target lookup.
 *
 * Root cause: on CocoaPods 1.16.x / Xcode 26, `project.targets.find` may return
 * nil for pods that register SPM dependencies (e.g. ClerkGoogleSignIn adds
 * ClerkKit + ClerkKitUI). Without a nil check the post-install hook crashes
 * with "undefined method `package_product_dependencies' for nil:NilClass".
 *
 * This script is invoked by the `eas-build-post-install` hook (after pnpm install,
 * before expo prebuild / pod install).
 */
const fs = require('fs');
const path = require('path');

const spmRbPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'scripts',
  'cocoapods',
  'spm.rb'
);

if (!fs.existsSync(spmRbPath)) {
  console.log('[patch-spm] spm.rb not found at', spmRbPath, '— skipping.');
  process.exit(0);
}

let content = fs.readFileSync(spmRbPath, 'utf8');

const ALREADY_PATCHED = "found_target = project.targets.find { |t| t.name == pod_name }";
if (content.includes(ALREADY_PATCHED)) {
  console.log('[patch-spm] spm.rb already patched — skipping.');
  process.exit(0);
}

const OLD = `    @dependencies_by_pod.each do |pod_name, dependencies|
      dependencies.each do |spm_spec|
        log "Adding SPM dependency on product \#{spm_spec[:products]}"
        add_spm_to_target(
          project,
          project.targets.find { |t| t.name == pod_name},
          spm_spec[:url],
          spm_spec[:requirement],
          spm_spec[:products]
        )
        log " Adding workaround for Swift package not found issue"
        target = project.targets.find { |t| t.name == pod_name}
        target.build_configurations.each do |config|
          target.build_settings(config.name)['SWIFT_INCLUDE_PATHS'] ||= ['$(inherited)']
          search_path = '\${SYMROOT}/\${CONFIGURATION}\${EFFECTIVE_PLATFORM_NAME}/'
          unless target.build_settings(config.name)['SWIFT_INCLUDE_PATHS'].include?(search_path)
            target.build_settings(config.name)['SWIFT_INCLUDE_PATHS'].push(search_path)
          end
        end
      end
    end`;

const NEW = `    @dependencies_by_pod.each do |pod_name, dependencies|
      found_target = project.targets.find { |t| t.name == pod_name }
      next if found_target.nil?
      dependencies.each do |spm_spec|
        log "Adding SPM dependency on product \#{spm_spec[:products]}"
        add_spm_to_target(
          project,
          found_target,
          spm_spec[:url],
          spm_spec[:requirement],
          spm_spec[:products]
        )
        log " Adding workaround for Swift package not found issue"
        found_target.build_configurations.each do |config|
          found_target.build_settings(config.name)['SWIFT_INCLUDE_PATHS'] ||= ['$(inherited)']
          search_path = '\${SYMROOT}/\${CONFIGURATION}\${EFFECTIVE_PLATFORM_NAME}/'
          unless found_target.build_settings(config.name)['SWIFT_INCLUDE_PATHS'].include?(search_path)
            found_target.build_settings(config.name)['SWIFT_INCLUDE_PATHS'].push(search_path)
          end
        end
      end
    end`;

if (!content.includes(OLD)) {
  console.warn('[patch-spm] WARNING: expected pattern not found in spm.rb.');
  console.warn('[patch-spm] The RN version may have changed. Dumping current apply_on_post_install:');
  const startIdx = content.indexOf('def apply_on_post_install');
  const endIdx = content.indexOf('\n  end\n', startIdx) + 7;
  console.warn(content.slice(startIdx, endIdx));
  console.warn('[patch-spm] Skipping patch — pod install may still fail.');
  process.exit(0);
}

content = content.replace(OLD, NEW);
fs.writeFileSync(spmRbPath, content, 'utf8');
console.log('[patch-spm] Successfully patched spm.rb — nil guard added for CocoaPods 1.16.x compatibility.');
