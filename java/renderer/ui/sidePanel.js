



export class SidePanel {
  constructor() {
    this.panel = document.getElementById('left-panel');
    this.isCollapsed = false; // Default state: expanded
    
    this.init();
  }

  init() {
    // Right-click dragging on the side panel
    if (this.panel) {
      this.panel.addEventListener('mousedown', (e) => {
        // Check for Right Click (button 2)
        if (e.button === 2) {
           e.preventDefault();
           if (window.browserAPI && window.browserAPI.window && window.browserAPI.window.startDrag) {
             window.browserAPI.window.startDrag();
           }
        }
      });

      // Prevent default context menu on the sidebar to avoid conflicts with dragging
      this.panel.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    }

    // Connect the Toggle Button
    const toggleBtn = document.getElementById('btn-sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggle();
      });
    }
  }

  toggle(forceCollapsed) {
    if (forceCollapsed !== undefined) {
      this.isCollapsed = forceCollapsed;
    } else {
      this.isCollapsed = !this.isCollapsed;
    }
    
    if (this.panel) {
      this.panel.classList.toggle('collapsed', this.isCollapsed);
    }
  }
}
