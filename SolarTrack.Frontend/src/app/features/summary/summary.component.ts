import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SummaryService } from '../../core/services/summary.service';
import { NavService } from '../../core/services/nav.service';
import { SummaryToolbarComponent } from './components/summary-toolbar/summary-toolbar.component';
import { SummaryTableComponent } from './components/summary-table/summary-table.component';
import { ActivityTabComponent } from './components/activity-tab/activity-tab.component';

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [
    CommonModule, 
    SummaryToolbarComponent, 
    SummaryTableComponent, 
    ActivityTabComponent
  ],
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss']
})
export class SummaryComponent implements OnInit {
  summaryService = inject(SummaryService);
  navService = inject(NavService);

  activeTab = signal<'SUMMARY' | 'ACTIVITY'>('SUMMARY');

  ngOnInit(): void {
    this.navService.setPageTitle('Summary');
    this.summaryService.loadAllData().subscribe({
      next: () => {},
      error: (err) => console.error('Error loading summary data:', err)
    });
  }

  setTab(tab: 'SUMMARY' | 'ACTIVITY'): void {
    this.activeTab.set(tab);
  }
}
