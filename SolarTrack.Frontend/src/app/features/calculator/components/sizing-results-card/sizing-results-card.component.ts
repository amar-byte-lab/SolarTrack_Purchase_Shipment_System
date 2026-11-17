import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalculatorService } from '../../services/calculator.service';

@Component({
  selector: 'app-sizing-results-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sizing-results-card.component.html',
  styleUrls: ['./sizing-results-card.component.scss']
})
export class SizingResultsCardComponent {
  readonly calc = inject(CalculatorService);

  @Output() openProductCatalog = new EventEmitter<'inverters' | 'batteries' | 'panels'>();

  readonly Math = Math;

  readonly cardColumnClass = computed(() => {
    const hasSolar = !!this.calc.result().solar;
    const hasBattery = !!this.calc.result().battery;

    if (hasSolar && hasBattery) {
      // 3 cards (Hybrid, Off-Grid) -> 3 columns
      return 'col-lg-4 col-md-6 col-12';
    } else {
      // 2 cards (On-Grid or Without Solar) -> 2 columns
      return 'col-md-6 col-12';
    }
  });
}
