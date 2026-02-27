



export class SidePanel {
  constructor() {
    this.panel = document.getElementById('left-panel');
    this.floatingToggle = document.getElementById('floating-sidebar-toggle');
    this.isCollapsed = false; // Default state: expanded
    this.isHidden = false; // New state: completely hidden

    this.dragState = {
      isDragging: false,
      hasMoved: false,
      startX: 0,
      startY: 0,
      initialLeft: 0,
      initialTop: 0,
      pointerId: null
    };

    this.sidebarWindowDrag = {
      pending: false,
      started: false,
      startX: 0,
      startY: 0,
      suppressClickUntil: 0
    };

    this.init();
  }

  init() {
    // Drag window from sidebar (left-click anywhere after slight movement, right-click anywhere)
    if (this.panel) {
      const startNativeWindowDrag = () => {
        if (window.browserAPI && window.browserAPI.window && window.browserAPI.window.startDrag) {
          window.browserAPI.window.startDrag();
        }
      };

      const resetSidebarWindowDrag = () => {
        this.sidebarWindowDrag.pending = false;
        this.sidebarWindowDrag.started = false;
      };

      this.panel.addEventListener('mousedown', (e) => {
        // Right Click (button 2) - always allows dragging
        if (e.button === 2) {
           e.preventDefault();
           startNativeWindowDrag();
        }
        // Left Click (button 0) - allow drag from any sidebar area, but only after movement threshold
        else if (e.button === 0) {
          this.sidebarWindowDrag.pending = true;
          this.sidebarWindowDrag.started = false;
          this.sidebarWindowDrag.startX = e.clientX;
          this.sidebarWindowDrag.startY = e.clientY;
        }
      });

      document.addEventListener('mousemove', (e) => {
        if (!this.sidebarWindowDrag.pending || this.sidebarWindowDrag.started) return;

        // Left button released before threshold
        if (typeof e.buttons === 'number' && (e.buttons & 1) === 0) {
          resetSidebarWindowDrag();
          return;
        }

        const dx = e.clientX - this.sidebarWindowDrag.startX;
        const dy = e.clientY - this.sidebarWindowDrag.startY;
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;

        this.sidebarWindowDrag.started = true;
        this.sidebarWindowDrag.suppressClickUntil = Date.now() + 400;
        startNativeWindowDrag();
      });

      document.addEventListener('mouseup', () => {
        resetSidebarWindowDrag();
      });

      window.addEventListener('blur', () => {
        resetSidebarWindowDrag();
      });

      // Prevent an accidental button/tab click after a drag gesture starts.
      this.panel.addEventListener('click', (e) => {
        if (Date.now() <= this.sidebarWindowDrag.suppressClickUntil) {
          e.preventDefault();
          e.stopPropagation();
          this.sidebarWindowDrag.suppressClickUntil = 0;
        }
      }, true);

      // Show context menu on right-click (instead of preventing it)
      this.panel.addEventListener('contextmenu', (e) => {
        // Dispatch a custom event that can be caught by renderer.js
        document.dispatchEvent(new CustomEvent('sidePanelContextMenu', {
          detail: { x: e.clientX, y: e.clientY }
        }));
        e.preventDefault();
      });
    }

    // Connect the Toggle Button
    const toggleBtn = document.getElementById('btn-sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      });
    }

    // Connect the Floating Toggle Button
    const clampFloatingTogglePosition = (left, top) => {
      if (!this.floatingToggle) return { left, top };
      const maxX = window.innerWidth - this.floatingToggle.offsetWidth;
      const maxY = window.innerHeight - this.floatingToggle.offsetHeight;
      const maxLeft = Math.max(6, maxX - 6);
      const maxTop = Math.max(6, maxY - 6);
      return {
        left: Math.max(6, Math.min(left, maxLeft)),
        top: Math.max(6, Math.min(top, maxTop))
      };
    };

    const applyFloatingTogglePosition = (left, top) => {
      if (!this.floatingToggle) return;
      this.floatingToggle.style.left = `${left}px`;
      this.floatingToggle.style.top = `${top}px`;
      this.floatingToggle.style.transform = "none";
    };

    const saveFloatingTogglePosition = () => {
      if (!this.floatingToggle) return;
      try {
        const rect = this.floatingToggle.getBoundingClientRect();
        const { left, top } = clampFloatingTogglePosition(rect.left, rect.top);
        localStorage.setItem("floatingSidebarTogglePosition", JSON.stringify({ left, top }));
      } catch (err) {
        console.warn("Could not persist floating toggle position", err);
      }
    };

    const restoreFloatingTogglePosition = () => {
      if (!this.floatingToggle) return;
      try {
        const saved = localStorage.getItem("floatingSidebarTogglePosition");
        if (!saved) return;
        const pos = JSON.parse(saved);
        if (typeof pos.left === "number" && typeof pos.top === "number") {
          const { left, top } = clampFloatingTogglePosition(pos.left, pos.top);
          applyFloatingTogglePosition(left, top);
        }
      } catch (err) {
        console.warn("Could not restore floating toggle position", err);
      }
    };

    const endFloatingDrag = (e) => {
      if (this.dragState.isDragging && e.pointerId === this.dragState.pointerId) {
        this.dragState.isDragging = false;
        this.dragState.pointerId = null;
        this.floatingToggle?.releasePointerCapture?.(e.pointerId);
        saveFloatingTogglePosition();
        setTimeout(() => { this.dragState.hasMoved = false; }, 0);
      }
    };

    if (this.floatingToggle) {
      restoreFloatingTogglePosition();

      this.floatingToggle.addEventListener("click", (e) => {
        if (!this.dragState.hasMoved) {
          e.preventDefault();
          e.stopPropagation();
          this.show();
        }
      });

      this.floatingToggle.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;

        const rect = this.floatingToggle.getBoundingClientRect();
        const { left, top } = clampFloatingTogglePosition(rect.left, rect.top);
        applyFloatingTogglePosition(left, top);

        this.dragState.isDragging = true;
        this.dragState.pointerId = e.pointerId;
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;
        this.dragState.hasMoved = false;
        this.dragState.initialLeft = left;
        this.dragState.initialTop = top;

        this.floatingToggle.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      });

      window.addEventListener("resize", () => {
        const rect = this.floatingToggle.getBoundingClientRect();
        const { left, top } = clampFloatingTogglePosition(rect.left, rect.top);
        applyFloatingTogglePosition(left, top);
      });
    }

    // Global pointer events for dragging
    document.addEventListener("pointermove", (e) => {
      if (this.dragState.isDragging && this.floatingToggle && e.pointerId === this.dragState.pointerId) {
        const dx = e.clientX - this.dragState.startX;
        const dy = e.clientY - this.dragState.startY;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          this.dragState.hasMoved = true;
        }

        const { left, top } = clampFloatingTogglePosition(
          this.dragState.initialLeft + dx,
          this.dragState.initialTop + dy
        );

        this.floatingToggle.style.left = left + "px";
        this.floatingToggle.style.top = top + "px";
        this.floatingToggle.style.transform = "none";
      }
    });

    document.addEventListener("pointerup", endFloatingDrag);
    document.addEventListener("pointercancel", endFloatingDrag);

    // Ensure proper state on load
    this.updatePanelState();
  }
  
  updatePanelState() {
    if (!this.panel) return;

    // Update all classes based on current state
    if (this.isHidden) {
      this.panel.classList.remove('collapsed');
      this.panel.classList.add('hidden');
      // Show floating toggle button when sidebar is hidden
      if (this.floatingToggle) {
        this.floatingToggle.classList.remove('hidden');
      }
    } else if (this.isCollapsed) {
      this.panel.classList.add('collapsed');
      this.panel.classList.remove('hidden');
      // Hide floating toggle button when sidebar is visible
      if (this.floatingToggle) {
        this.floatingToggle.classList.add('hidden');
      }
    } else {
      this.panel.classList.remove('collapsed', 'hidden');
      // Hide floating toggle button when sidebar is visible
      if (this.floatingToggle) {
        this.floatingToggle.classList.add('hidden');
      }
    }
  }

  toggle(forceCollapsed) {
    if (forceCollapsed !== undefined) {
      this.isCollapsed = forceCollapsed;
    } else {
      this.isCollapsed = !this.isCollapsed;
    }
    
    // Reset hidden state when toggling
    if (this.isHidden) {
      this.isHidden = false;
    }
    
    this.updatePanelState();
  }

  /**
   * Hide the sidebar completely
   */
  hide() {
    this.isHidden = true;
    this.isCollapsed = false;
    this.updatePanelState();
  }

  /**
   * Show the sidebar (restore to previous state)
   */
  show() {
    this.isHidden = false;
    this.updatePanelState();
  }

  /**
   * Toggle between hidden and visible states
   */
  toggleHidden() {
    this.isHidden = !this.isHidden;
    if (!this.isHidden) {
      this.isCollapsed = false;
    }
    this.updatePanelState();
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isCollapsed: this.isCollapsed,
      isHidden: this.isHidden
    };
  }

  /**
   * Restore to expanded state
   */
  restore() {
    this.isHidden = false;
    this.isCollapsed = false;
    this.updatePanelState();
  }}
