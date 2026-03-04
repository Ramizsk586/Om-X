
/**
 * Handles Address Bar interactions.
 * This class encapsulates logic for processing user input in the URL bar.
 */
import { normalizeInput, isLikelyUrl, composeSearchUrl } from '../../utils/urlUtils.js';

export class AddressBar {
  constructor(inputElement, onNavigate) {
    this.input = inputElement;
    this.onNavigate = onNavigate;
    
    if(this.input) {
        this.input.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.input.addEventListener('focus', () => this.input.select());
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Enter') {
      const value = this.input.value.trim();
      if (!value) return;
      
      let url;
      if (isLikelyUrl(value)) {
        url = normalizeInput(value);
      } else {
        url = composeSearchUrl(value);
      }
      
      if (this.onNavigate) this.onNavigate(url);
      this.input.blur();
    }
  }

  setValue(val) {
    if(this.input) this.input.value = val;
  }
}
