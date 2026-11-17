import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InstallmentRow } from '../../../../core/models/summary.model';
import { TechnicalProductSpecs } from '../../models/document.model';

@Component({
  selector: 'app-form3-inspection',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './form3-inspection.component.html',
  styleUrls: ['./form3-inspection.component.scss']
})
export class Form3InspectionComponent {
  @Input() customer: InstallmentRow | null = null;
  @Input() specs: TechnicalProductSpecs = {};

  @Output() editSpecsClicked = new EventEmitter<void>();
  @Output() previewClicked = new EventEmitter<void>();
  @Output() resetClicked = new EventEmitter<void>();
}
