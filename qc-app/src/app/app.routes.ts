import { Routes } from '@angular/router';
import { appGuard, pinGuard, registerGuard } from './core/auth/guards';
import { unsavedChangesGuard } from './features/inspection/unsaved-changes.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'requests' },
  {
    path: 'register',
    canActivate: [registerGuard],
    loadComponent: () => import('./features/access/registration').then((m) => m.RegistrationPage),
    title: 'Register – WFX Quality Controller',
  },
  {
    path: 'pin',
    canActivate: [pinGuard],
    loadComponent: () => import('./features/access/pin').then((m) => m.PinPage),
    title: 'PIN – WFX Quality Controller',
  },
  {
    // QC Add-Ons: opened from the "New" button on the request list (New Sample Evaluation / New Inspection)
    path: 'addons',
    canActivate: [appGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: '/requests' }, // no separate home page: the request list is the start screen
      { path: 'inspection/new', loadComponent: () => import('./features/addons/new-inspection').then((m) => m.NewInspectionPage), title: 'New Inspection – WFX Quality Controller' },
      { path: 'sample-evaluation/new', loadComponent: () => import('./features/addons/new-sample').then((m) => m.NewSamplePage), title: 'New Sample Evaluation – WFX Quality Controller' },
    ],
  },
  {
    path: 'requests',
    canActivate: [appGuard],
    loadComponent: () => import('./features/requests/request-list').then((m) => m.RequestListPage),
    title: 'Requests – WFX Quality Controller',
  },
  {
    path: 'requests/:requestId/orders/:orderId/report',
    canActivate: [appGuard],
    loadComponent: () => import('./features/requests/report-viewer').then((m) => m.ReportViewerPage),
    title: 'Report – WFX Quality Controller',
  },
  {
    path: 'requests/:requestId/orders/:orderId/inspect',
    canActivate: [appGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./features/inspection/inspection-shell').then((m) => m.InspectionShell),
    title: 'Inspection Result – WFX Quality Controller',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'summary' },
      { path: 'summary', loadComponent: () => import('./features/inspection/sections/summary').then((m) => m.SummarySection) },
      { path: 'ra-sheet', loadComponent: () => import('./features/inspection/sections/ra-sheet').then((m) => m.RaSheetSection) },
      { path: 'measurements', loadComponent: () => import('./features/inspection/sections/measurements').then((m) => m.MeasurementsSection) },
      { path: 'defects', loadComponent: () => import('./features/inspection/sections/defects').then((m) => m.DefectsSection) },
      { path: 'final', loadComponent: () => import('./features/inspection/sections/final-result').then((m) => m.FinalResultSection) },
      // config-driven evaluation groups (Measurement / Quality / Packing results …)
      { path: 'evaluation/:groupId', loadComponent: () => import('./features/inspection/sections/evaluation').then((m) => m.EvaluationSection) },
    ],
  },
  {
    path: 'images',
    canActivate: [appGuard],
    loadComponent: () => import('./features/images/images-page').then((m) => m.ImagesPage),
    title: 'Images – WFX Quality Controller',
  },
  {
    // extra tool: the real app inside a resizable frame + quick jump between screens (normal flow is unchanged)
    path: 'preview',
    canActivate: [appGuard],
    loadComponent: () => import('./features/preview/screen-preview').then((m) => m.ScreenPreviewPage),
    title: 'Screen preview – WFX Quality Controller',
  },
  {
    path: 'profile',
    canActivate: [appGuard],
    loadComponent: () => import('./features/settings/profile').then((m) => m.ProfilePage),
    title: 'User Profile – WFX Quality Controller',
  },
  { path: '**', redirectTo: 'requests' },
];
