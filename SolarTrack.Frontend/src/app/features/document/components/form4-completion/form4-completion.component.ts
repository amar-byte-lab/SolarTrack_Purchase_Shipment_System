import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { InstallmentRow } from '../../../../core/models/summary.model';
import { TechnicalProductSpecs } from '../../models/document.model';

@Component({
  selector: 'app-form4-completion',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './form4-completion.component.html',
  styleUrls: ['./form4-completion.component.scss']
})
export class Form4CompletionComponent {
  @Input() customer: InstallmentRow | null = null;
  @Input() specs: TechnicalProductSpecs = {};

  @Output() editSpecsClicked = new EventEmitter<void>();
  @Output() previewClicked = new EventEmitter<void>();
  @Output() resetClicked = new EventEmitter<void>();
}
