// script.js

// Sticky Navigation
(function() {
  const mainNav = document.querySelector('.main-nav');
  if (!mainNav) return;

  let lastScrollTop = 0;
  const scrollThreshold = 50;

  function handleScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > scrollThreshold) {
      mainNav.classList.add('sticky');
      document.body.classList.add('has-sticky-nav');
    } else {
      mainNav.classList.remove('sticky');
      document.body.classList.remove('has-sticky-nav');
    }
    
    lastScrollTop = scrollTop;
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Check on page load
})();

// Dropdown Menu Toggle (for click on mobile, hover on desktop)
(function() {
  const dropdowns = document.querySelectorAll('.nav-dropdown');
  
  dropdowns.forEach(dropdown => {
    const category = dropdown.querySelector('.nav-category');
    
    // Click toggle for mobile
    if (category) {
      category.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          dropdown.classList.toggle('active');
          
          // Close other dropdowns
          dropdowns.forEach(other => {
            if (other !== dropdown) {
              other.classList.remove('active');
            }
          });
        }
      });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!dropdown.contains(e.target) && window.innerWidth <= 768) {
        dropdown.classList.remove('active');
      }
    });
  });
})();

// Mobile Menu Toggle
(function() {
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const mobileMenuClose = document.querySelector('.mobile-menu-close');
  const body = document.body;

  if (!mobileMenuToggle || !mobileMenu) return;

  function openMobileMenu() {
    mobileMenu.classList.add('active');
    body.style.overflow = 'hidden';
    mobileMenuToggle.setAttribute('aria-expanded', 'true');
  }

  function closeMobileMenu() {
    mobileMenu.classList.remove('active');
    body.style.overflow = '';
    mobileMenuToggle.setAttribute('aria-expanded', 'false');
  }

  mobileMenuToggle.addEventListener('click', openMobileMenu);
  if (mobileMenuClose) {
    mobileMenuClose.addEventListener('click', closeMobileMenu);
  }

  // Close mobile menu when clicking on a link
  const mobileMenuLinks = mobileMenu.querySelectorAll('a');
  mobileMenuLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMobileMenu();
    });
  });

  // Close mobile menu on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
      closeMobileMenu();
    }
  });
  
  // Make closeMobileMenu available globally for other scripts if needed
  window.closeMobileMenu = closeMobileMenu;
})();

// Mobile Dropdown Toggle
(function() {
  const mobileDropdowns = document.querySelectorAll('.mobile-nav-dropdown');
  
  mobileDropdowns.forEach(dropdown => {
    const category = dropdown.querySelector('.mobile-nav-category');
    
    if (category) {
      category.addEventListener('click', function(e) {
        e.preventDefault();
        dropdown.classList.toggle('active');
        
        // Close other mobile dropdowns
        mobileDropdowns.forEach(other => {
          if (other !== dropdown) {
            other.classList.remove('active');
          }
        });
      });
    }
  });
})();

// Active State Management
(function() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.main-nav a, .mobile-menu-content a, .nav-dropdown-menu a');
  
  navLinks.forEach(link => {
    const linkPath = new URL(link.href).pathname;
    
    // Check if current page matches link
    if (currentPath === linkPath || 
        (currentPath === '/' && linkPath === '/index.html') ||
        (currentPath.endsWith(linkPath) && linkPath !== '/')) {
      link.classList.add('active');
      
      // Also mark parent dropdown as active if applicable
      const dropdown = link.closest('.nav-dropdown');
      if (dropdown) {
        dropdown.classList.add('active');
      }
    }
  });
})();

// Smooth Scroll (optional enhancement)
(function() {
  const links = document.querySelectorAll('a[href^="#"]');
  
  links.forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
})();
