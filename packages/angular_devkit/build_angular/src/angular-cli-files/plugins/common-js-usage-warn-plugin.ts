
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { isAbsolute } from 'path';
import { Compiler, compilation } from 'webpack';

// Webpack doesn't export these so the deep imports can potentially break.
const CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency');
const AMDDefineDependency = require('webpack/lib/dependencies/AMDDefineDependency');

// The below is extended because there are not in the typings
interface WebpackModule extends compilation.Module {
  name?: string;
  rawRequest?: string;
  dependencies: unknown[];
  issuer: WebpackModule | null;
  userRequest?: string;
}

export interface CommonJsUsageWarnPluginOptions {
  /** A list of CommonJS packages that are allowed to be used without a warning. */
  allowedDepedencies?: string[];
}

export class CommonJsUsageWarnPlugin {
  private shownWarnings = new Set<string>();

  constructor(private options: CommonJsUsageWarnPluginOptions = {}) {

  }

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap('CommonJsUsageWarnPlugin', compilation => {
      compilation.hooks.finishModules.tap('CommonJsUsageWarnPlugin', modules => {
        for (const { dependencies, rawRequest, issuer } of modules as unknown as WebpackModule[]) {
          if (
            !rawRequest ||
            rawRequest.startsWith('.') ||
            isAbsolute(rawRequest)
          ) {
            // Skip if module is absolute or relative.
            continue;
          }

          if (this.options.allowedDepedencies?.includes(rawRequest)) {
            // Skip as this module is allowed even if it's a CommonJS.
            continue;
          }

          if (this.hasCommonJsDependencies(dependencies)) {
            // Dependency is CommonsJS or AMD.

            // Check if it's parent issuer is also a CommonJS dependency.
            // In case it is skip as an warning will be show for the parent CommonJS dependency.
            if (this.hasCommonJsDependencies(issuer?.issuer?.dependencies ?? [])) {
              continue;
            }

            // Find the main issuer (entry-point).
            let mainIssuer = issuer;
            while (mainIssuer?.issuer) {
              mainIssuer = mainIssuer.issuer;
            }

            // Only show warnings for modules from main entrypoint.
            if (mainIssuer?.name === 'main') {
              const warning = `${issuer?.userRequest} depends on ${rawRequest}. CommonJS or AMD dependencies can cause optimization bailouts.`;

              // Avoid showing the same warning multiple times when in 'watch' mode.
              if (!this.shownWarnings.has(warning)) {
                compilation.warnings.push(warning);
                this.shownWarnings.add(warning);
              }
            }
          }
        }
      });
    });
  }

  private hasCommonJsDependencies(dependencies: unknown[]): boolean {
    return dependencies.some(d => d instanceof CommonJsRequireDependency || d instanceof AMDDefineDependency);
  }

}
