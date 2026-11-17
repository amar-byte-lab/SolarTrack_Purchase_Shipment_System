import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';
import { LayoutComponent } from './layout/layout.component';
import { SummaryComponent } from './features/summary/summary.component';
import { QuotationComponent } from './features/quotation/quotation.component';
import { LedgerComponent } from './features/ledger/ledger.component';
import { ReportsComponent } from './features/reports/reports.component';
import { SettingsComponent } from './features/settings/settings.component';
import { FilesComponent } from './features/files/files.component';
import { DocumentComponent } from './features/document/document.component';
import { InventoryComponent } from './features/inventory/inventory.component';
import { CalculatorComponent } from './features/calculator/calculator.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'summary', component: SummaryComponent },
      { path: 'quotation', component: QuotationComponent },
      { path: 'ledger', component: LedgerComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'files', component: FilesComponent },
      { path: 'inventory', component: InventoryComponent },
      { path: 'sizing-calc', component: CalculatorComponent },
      { path: 'calculator', component: CalculatorComponent },
      { path: 'document', component: DocumentComponent },
      { path: 'agreement', component: DocumentComponent },
      { path: '', redirectTo: 'summary', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'summary' }
];
