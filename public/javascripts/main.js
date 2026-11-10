// L'uso di "defer" nell'HTML garantisce che il DOM sia pronto (Slide 16)
document.addEventListener('DOMContentLoaded', () => {
    
    /* =================================================================
       1. EFFETTO NAVBAR SCROLL (DOM Manipulation - classList)
       ================================================================= */
    const navbar = document.querySelector('.navbar');
    if(navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    /* =================================================================
       2. GALLERIA PRODOTTO (Gestione Eventi)
       ================================================================= */
    const thumbnails = document.querySelectorAll('.thumb');
    const mainImage = document.querySelector('.main-image-container img');

    if(thumbnails.length > 0 && mainImage) {
        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', function() {
                thumbnails.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                const newSrc = this.querySelector('img').getAttribute('src');
                mainImage.style.opacity = '0'; // Manipolazione Stile Inline (Slide 16)
                setTimeout(() => {
                    mainImage.setAttribute('src', newSrc);
                    mainImage.style.opacity = '1';
                }, 200); 
            });
        });
    }

    /* =================================================================
       3. FETCH API PER IL CARRELLO (Richieste Asincrone - Slide 17)
       ================================================================= */
  /* =================================================================
       3. FETCH API PER IL CARRELLO (Slide 15 - Consumo REST API)
       ================================================================= */
    const cartForms = document.querySelectorAll('form[action^="/cart/add"]');
    
    cartForms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            
            // Di base il form punta a /cart/add/:id (per il fallback HTML).
            // Noi intercettiamo l'URL e lo trasformiamo per usare la REST API dedicata.
            const originalUrl = form.getAttribute('action');
            const apiUrl = originalUrl.replace('/cart/add', '/api/cart/add'); // Rispetta la Slide 15
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (result.success) {
                    const badges = document.querySelectorAll('.badge');
                    badges.forEach(badge => {
                        badge.textContent = result.cartCount;
                        badge.classList.remove('pop');
                        void badge.offsetWidth; 
                        badge.classList.add('pop');
                    });
                    showToast('Drop aggiunto alla bag tramite REST API!');
                }
            } catch (error) {
                console.error('Errore Fetch API:', error);
                showToast('Errore di connessione al server.', true);
            }
        });
    });

    /* =================================================================
       4. CREAZIONE DINAMICA ELEMENTI DOM (Slide 16)
       ================================================================= */
    function showToast(message, isError = false) {
        // Creazione di un nuovo nodo DOM da zero
        const toast = document.createElement('div');
        toast.classList.add('toast-notification');
        if (isError) toast.classList.add('error');
        toast.textContent = message;
        
        // Aggiunta al body
        document.body.appendChild(toast);
        
        // Entrata fluida
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Distruzione automatica dopo 3 secondi per non sporcare la memoria
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400); // Attende la fine del CSS transition
        }, 3000);
    }
    
});