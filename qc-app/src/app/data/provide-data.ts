import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AuthRepository, InspectionRepository, MastersRepository } from './repositories';
import { MockAuthRepository, MockInspectionRepository, MockMastersRepository } from './mock/mock-repositories';

/**
 * Single place that binds repository contracts to implementations.
 * When the real API is available, add Http*Repository classes and select them here
 * (environment.useMock === false). No feature code needs to change.
 */
export function provideData(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AuthRepository, useExisting: MockAuthRepository },
    { provide: InspectionRepository, useExisting: MockInspectionRepository },
    { provide: MastersRepository, useExisting: MockMastersRepository },
  ]);
}
