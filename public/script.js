document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const nav = document.getElementById('main-nav');
    const cartToggle = document.getElementById('cart-toggle');
    const closeCart = document.getElementById('close-cart');
    const cartDrawer = document.getElementById('cart-drawer');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    let cart = JSON.parse(localStorage.getItem('chaya_cart')) || [];
    let currentUser = null;

    // Mobile Menu
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
        });
    }

    // Scroll Reveal Observer
    const revealOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);

    document.querySelectorAll('.reveal').forEach(el => {
        revealObserver.observe(el);
    });

    // Cart Drawer Toggle
    if (cartToggle) {
        cartToggle.addEventListener('click', () => {
            cartDrawer.classList.add('active');
            renderCart();
        });
    }

    if (closeCart) {
        closeCart.addEventListener('click', () => {
            cartDrawer.classList.remove('active');
        });
    }

    // Add to Cart Logic
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const name = e.target.dataset.name;
            const price = parseFloat(e.target.dataset.price);

            addToCart({ id, name, price });

            // Visual feedback
            const originalText = e.target.innerText;
            e.target.innerText = 'Added!';
            e.target.classList.add('btn-success');

            setTimeout(() => {
                e.target.innerText = originalText;
                e.target.classList.remove('btn-success');
            }, 1000);
        });
    });

    function addToCart(product) {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        updateCart();
    }

    function removeFromCart(id) {
        cart = cart.filter(item => item.id !== id);
        updateCart();
    }

    function updateCart() {
        localStorage.setItem('chaya_cart', JSON.stringify(cart));
        updateCartCount();
        renderCart();
    }

    function updateCartCount() {
        const count = cart.reduce((total, item) => total + item.quantity, 0);
        cartCount.innerText = count;
    }

    function renderCart() {
        if (!cartItemsContainer) return;

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-msg">Your cart is empty.</p>';
            cartTotal.innerText = '0 tk';
            checkoutBtn.disabled = true;
            return;
        }

        cartItemsContainer.innerHTML = '';
        let total = 0;

        cart.forEach(item => {
            total += item.price * item.quantity;
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item';
            itemElement.innerHTML = `
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <p>${item.price.toLocaleString()} tk x ${item.quantity}</p>
                </div>
                <span class="material-icons remove-item" data-id="${item.id}">delete_outline</span>
            `;
            cartItemsContainer.appendChild(itemElement);
        });

        cartTotal.innerText = `${total.toLocaleString()} tk`;
        checkoutBtn.disabled = false;

        // Add event listeners for remove buttons
        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                removeFromCart(e.target.dataset.id);
            });
        });
    }

    // Checkout / Payment Simulation
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            const selectedPayment = document.querySelector('input[name="payment"]:checked').value;
            const total = cartTotal.innerText;

            const name = document.getElementById('delivery-name').value.trim();
            const phone = document.getElementById('delivery-phone').value.trim();
            const address = document.getElementById('delivery-address').value.trim();

            if (!name || !phone || !address) {
                alert('Please fill out all delivery information fields before confirming payment.');
                return;
            }

            try {
                if (selectedPayment === 'bkash') {
                    checkoutBtn.innerText = 'Redirecting to bKash...';
                    checkoutBtn.disabled = true;

                    const response = await fetch('/api/bkash/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: currentUser ? currentUser.id : null,
                            name,
                            phone,
                            address,
                            total,
                            items: cart
                        })
                    });
                    const data = await response.json();

                    if (response.ok && data.bkashURL) {
                        cart = [];
                        updateCart();
                        window.location.href = data.bkashURL;
                    } else {
                        alert(`bKash payment failed to initialize: ${data.error || 'Unknown error'}`);
                        checkoutBtn.innerText = 'Confirm Payment';
                        checkoutBtn.disabled = false;
                    }
                } else {
                    const response = await fetch('/api/checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: currentUser ? currentUser.id : null,
                            name,
                            phone,
                            address,
                            total,
                            paymentMethod: selectedPayment,
                            items: cart
                        })
                    });

                    if (response.ok) {
                        alert(`Payment Successful!\nThank you, ${name}.\nYour order will be delivered to: ${address}`);
                        cart = [];
                        updateCart();
                        
                        document.getElementById('delivery-name').value = '';
                        document.getElementById('delivery-phone').value = '';
                        document.getElementById('delivery-address').value = '';

                        cartDrawer.classList.remove('active');
                    } else {
                        const data = await response.json();
                        alert(`Failed to process order: ${data.error}`);
                    }
                }
            } catch (err) {
                console.error(err);
                alert('An error occurred while processing your order.');
                checkoutBtn.innerText = 'Confirm Payment';
                checkoutBtn.disabled = false;
            }
        });
    }

    const authTrigger = document.getElementById('auth-modal-toggle');
    const authModal = document.getElementById('auth-modal');
    const closeModals = document.querySelectorAll('.close-modal');
    const demoBtn = document.getElementById('demo-designs-btn');
    const demoModal = document.getElementById('demo-modal');
    const quoteTrigger = document.getElementById('quote-trigger');
    const quoteModal = document.getElementById('quote-modal');

    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            demoModal.style.display = 'block';
        });
    }

    if (quoteTrigger) {
        quoteTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            quoteModal.style.display = 'block';
        });
    }

    if (authTrigger) {
        authTrigger.addEventListener('click', () => {
            authModal.style.display = 'block';
        });
    }

    closeModals.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Auth Tab Switching
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');

    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            authTabs.forEach(t => t.classList.remove('active'));
            authForms.forEach(f => f.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`${targetTab}-form`).classList.add('active');
        });
    });

    // Form Submissions
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();

                if (res.ok) {
                    currentUser = data.user;
                    alert(`Welcome back to Chaya, ${currentUser.name}!`);
                    authModal.style.display = 'none';
                } else {
                    alert(`Login failed: ${data.error}`);
                }
            } catch (err) {
                alert('An error occurred during login.');
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm').value;

            if (password !== confirmPassword) {
                return alert('Passwords do not match');
            }

            try {
                const res = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await res.json();

                if (res.ok) {
                    alert('Account created successfully! You can now log in.');
                    document.querySelector('.auth-tab[data-tab="login"]').click();
                    signupForm.reset();
                } else {
                    alert(`Signup failed: ${data.error}`);
                }
            } catch (err) {
                alert('An error occurred during signup.');
            }
        });
    }

    // Quote Form Submission
    const quoteForm = document.getElementById('quote-form');
    if (quoteForm) {
        quoteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('quote-name').value;
            const material = document.getElementById('quote-material').value;
            const areaSize = document.getElementById('quote-area').value;

            try {
                const res = await fetch('/api/quote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, material, areaSize })
                });
                const data = await res.json();

                if (res.ok) {
                    alert('Thank you! Your quote request has been sent to the Chaya team.');
                    quoteModal.style.display = 'none';
                    quoteForm.reset();
                } else {
                    alert(`Failed to submit quote: ${data.error}`);
                }
            } catch (err) {
                alert('An error occurred while submitting the quote.');
            }
        });
    }

    // Initial count update
    updateCartCount();

    // Add smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

