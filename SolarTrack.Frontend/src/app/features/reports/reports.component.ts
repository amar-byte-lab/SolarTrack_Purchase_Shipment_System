import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from './services/report.service';
import { NavService } from '../../core/services/nav.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit {
  reportService = inject(ReportService);
  navService = inject(NavService);

  ngOnInit(): void {
    this.navService.setPageTitle('Reports & Analytics');
    this.onGenerateReport();
  }

  onGenerateReport(): void {
    this.reportService.generateReport().subscribe({
      next: () => {},
      error: (err) => console.error('Failed to generate report:', err)
    });
  }

  printReport(): void {
    window.print();
  }
}
