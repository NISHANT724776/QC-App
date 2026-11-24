import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Central success / error / info notifications (the source app's coloured snackbars). */
@Injectable({ providedIn: 'root' })
export class Toast {
  private readonly bar = inject(MatSnackBar);

  success(message: string): void {
    this.open(message, 'toast-success');
  }
  error(message: string): void {
    this.open(message, 'toast-error', 5000);
  }
  info(message: string): void {
    this.open(message, 'toast-info');
  }

  private open(message: string, cls: string, duration = 3000): void {
    this.bar.open(message, undefined, { duration, panelClass: [cls], horizontalPosition: 'center', verticalPosition: 'top' });
  }
}
