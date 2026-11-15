import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      [attr.width]="size" 
      [attr.height]="size" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-linecap="round" 
      stroke-linejoin="round"
      [attr.stroke-width]="strokeWidth"
      [ngClass]="customClass">
      <ng-container [ngSwitch]="name">
        <!-- summary -->
        <ng-container *ngSwitchCase="'summary'">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </ng-container>
        <!-- briefcase / manage-work -->
        <ng-container *ngSwitchCase="'briefcase'">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </ng-container>
        <!-- customer / user -->
        <ng-container *ngSwitchCase="'customer'">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </ng-container>
        <!-- boxes / inventory -->
        <ng-container *ngSwitchCase="'boxes'">
          <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l6 3.43a2 2 0 0 0 2.06 0l6-3.43a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L11 9.49a2 2 0 0 0-2.06 0l-5.97 3.43z"/><path d="m12 22v-9.5"/><path d="M7 17.5v-3.5L12 11l5 3v3.5"/><path d="M12 2.5 4.5 6.8v4.4l7.5 4.3 7.5-4.3V6.8L12 2.5z"/>
        </ng-container>
        <!-- truck / shipment -->
        <ng-container *ngSwitchCase="'truck'">
          <rect x="1" y="3" width="14" height="13" rx="1"/><polygon points="15 8 19 8 22 11 22 16 15 16 15 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/>
        </ng-container>
        <!-- file -->
        <ng-container *ngSwitchCase="'file'">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </ng-container>
        <!-- offer / quotation -->
        <ng-container *ngSwitchCase="'offer'">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
        </ng-container>
        <!-- agreement / document -->
        <ng-container *ngSwitchCase="'agreement'">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/>
        </ng-container>
        <!-- calculator / sizing -->
        <ng-container *ngSwitchCase="'calculator'">
          <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"/>
        </ng-container>
        <!-- circuit / sld -->
        <ng-container *ngSwitchCase="'circuit'">
          <circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><line x1="8.5" y1="6" x2="14" y2="6"/><line x1="14" y1="6" x2="14" y2="18"/><line x1="14" y1="18" x2="15.5" y2="18"/><circle cx="6" cy="18" r="2.5"/><line x1="6" y1="8.5" x2="6" y2="15.5"/>
        </ng-container>
        <!-- wallet / ledger -->
        <ng-container *ngSwitchCase="'wallet'">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
        </ng-container>
        <!-- gear / settings -->
        <ng-container *ngSwitchCase="'gear'">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </ng-container>
        <!-- search -->
        <ng-container *ngSwitchCase="'search'">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </ng-container>
        <!-- plus -->
        <ng-container *ngSwitchCase="'plus'">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </ng-container>
        <!-- trash -->
        <ng-container *ngSwitchCase="'trash'">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </ng-container>
        <!-- download -->
        <ng-container *ngSwitchCase="'download'">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </ng-container>
        <!-- print -->
        <ng-container *ngSwitchCase="'print'">
          <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
        </ng-container>
        <!-- logout -->
        <ng-container *ngSwitchCase="'logout'">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </ng-container>
      </ng-container>
    </svg>
  `
})
export class IconComponent {
  @Input() name: string = '';
  @Input() size: number = 16;
  @Input() strokeWidth: number = 1.75;
  @Input() customClass: string = '';
}
