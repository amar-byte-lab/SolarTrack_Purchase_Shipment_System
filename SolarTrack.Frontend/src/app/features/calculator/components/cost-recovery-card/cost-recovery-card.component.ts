import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalculatorService } from '../../services/calculator.service';

@Component({
  selector: 'app-cost-recovery-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cost-recovery-card.component.html',
  styleUrls: ['./cost-recovery-card.component.scss']
})
export class CostRecoveryCardComponent {
  readonly calc = inject(CalculatorService);
  readonly showBreakdown = signal<boolean>(false);
  readonly Math = Math;
}
