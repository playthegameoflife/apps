if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }
    (function () {
      const p = new URLSearchParams(location.search);
      const t = p.get('p') || p.get('text') || p.get('title');
      if (t) {
        const el = document.getElementById('prompt-input');
        if (el && !el.value) el.value = t;
      }
    })();
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(a.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    // Nav scroll effect (shell pages use .topbar, legacy pages use .nav)
    const nav = document.querySelector('.nav') || document.querySelector('.topbar');
    if (nav) window.addEventListener('scroll', () => {
      if (window.scrollY > 20) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    }, { passive: true });
    // Fade-in on scroll
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.bento-card, .testimonial, .card').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });
