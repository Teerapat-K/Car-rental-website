document.addEventListener('DOMContentLoaded', () => {
    // Application State
    const state = {
        searchParams: {},
        selectedCar: null
    };

    // DOM Elements
    const elements = {
        sections: {
            categories: document.getElementById('categories-section'),
            adminLogin: document.getElementById('admin-login-section'),
            adminFleet: document.getElementById('admin-fleet-section'),
            search: document.getElementById('search-section'),
            cars: document.getElementById('cars-section'),
            payment: document.getElementById('payment-section'),
            success: document.getElementById('success-section'),
            dashboard: document.getElementById('dashboard-section'),
            profile: document.getElementById('profile-section')
        },
        forms: {
            adminLogin: document.getElementById('admin-login-form'),
            search: document.getElementById('search-form'),
            payment: document.getElementById('payment-form'),
            profileSearch: document.getElementById('profile-search-form')
        },
        inputs: {
            adminEmail: document.getElementById('admin-email'),
            adminPassword: document.getElementById('admin-password'),
            pickupLoc: document.getElementById('pickup-location'),
            returnLoc: document.getElementById('return-location'),
            pickupDate: document.getElementById('pickup-date'),
            returnDate: document.getElementById('return-date'),
            profileTdl: document.getElementById('profile-tdl')
        },
        containers: {
            categoriesGrid: document.getElementById('categories-grid'),
            fleetList: document.getElementById('fleet-list'),
            adminLoginMessage: document.getElementById('admin-login-message'),
            carsList: document.getElementById('cars-list'),
            searchMessage: document.getElementById('search-message'),
            paymentMessage: document.getElementById('payment-message'),
            dashboardGrid: document.getElementById('dashboard-grid'),
            profileError: document.getElementById('profile-error'),
            profileDetails: document.getElementById('profile-details'),
            bookingHistory: document.getElementById('booking-history-list')
        },
        buttons: {
            navCategories: document.getElementById('nav-categories'),
            navAdmin: document.getElementById('nav-admin'),
            backToSearch: document.getElementById('back-to-search'),
            cancelPayment: document.getElementById('cancel-payment'),
            viewHistory: document.getElementById('view-history'),
            navRent: document.getElementById('nav-rent'),
            navDashboard: document.getElementById('nav-dashboard'),
            navProfile: document.getElementById('nav-profile')
        }
    };

    // Initialize: Fetch Locations
    async function loadLocations() {
        try {
            const res = await fetch('/api/locations');
            if (!res.ok) throw new Error('Failed to fetch locations');
            const locations = await res.json();
            
            locations.forEach(loc => {
                const id = loc.location_id;
                const name = `${loc.city} - ${loc.address}`;
                
                elements.inputs.pickupLoc.add(new Option(name, id));
                elements.inputs.returnLoc.add(new Option(name, id));
            });
        } catch (err) {
            console.error('Initialization error:', err);
            elements.containers.searchMessage.textContent = 'Failed to load locations from database. Ensure backend is running.';
            elements.containers.searchMessage.className = 'message error';
        }
    }

    loadLocations();

    // Navigation logic
    function showSection(sectionToShow) {
        Object.values(elements.sections).forEach(sec => sec.classList.add('hidden'));
        sectionToShow.classList.remove('hidden');
    }

    function updateNav(activeBtn) {
        elements.buttons.navCategories.classList.remove('active');
        elements.buttons.navRent.classList.remove('active');
        elements.buttons.navDashboard.classList.remove('active');
        elements.buttons.navProfile.classList.remove('active');
        elements.buttons.navAdmin.classList.remove('active');
        activeBtn.classList.add('active');
    }

    elements.buttons.navCategories.addEventListener('click', () => {
        updateNav(elements.buttons.navCategories);
        showSection(elements.sections.categories);
        loadCategories();
    });

    elements.buttons.navRent.addEventListener('click', () => {
        updateNav(elements.buttons.navRent);
        showSection(elements.sections.search);
    });

    elements.buttons.navDashboard.addEventListener('click', async () => {
        updateNav(elements.buttons.navDashboard);
        showSection(elements.sections.dashboard);
        await loadDashboard();
    });

    elements.buttons.navProfile.addEventListener('click', () => {
        updateNav(elements.buttons.navProfile);
        showSection(elements.sections.profile);
    });

    elements.buttons.navAdmin.addEventListener('click', () => {
        updateNav(elements.buttons.navAdmin);
        if (state.adminLoggedIn) {
            showSection(elements.sections.adminFleet);
            loadAdminFleet();
        } else {
            showSection(elements.sections.adminLogin);
        }
    });

    // --- New Features Logic ---

    // Categories Feature
    async function loadCategories() {
        elements.containers.categoriesGrid.innerHTML = 'Loading categories...';
        try {
            const res = await fetch('/api/categories');
            if (!res.ok) throw new Error('Failed to load categories');
            const data = await res.json();
            
            elements.containers.categoriesGrid.innerHTML = '';
            if (data.length === 0) {
                elements.containers.categoriesGrid.innerHTML = '<p>No categories found.</p>';
            } else {
                data.forEach(cat => {
                    // Map category name to image filename
                    let imageName = 'default.png'; // Fallback
                    const label = cat.typeLabel.toLowerCase();
                    if (label.includes('economy')) imageName = 'economy_car.jpg';
                    else if (label.includes('suv')) imageName = 'suv_car.png';
                    else if (label.includes('pickup')) imageName = 'pickup_car.jpg';
                    else if (label.includes('luxury')) imageName = 'luxury_car.jpg';
                    else if (label.includes('ev')) imageName = 'EV_car.jpg';

                    const card = document.createElement('div');
                    card.className = 'car-card';
                    card.innerHTML = `
                        <div class="car-image-container" style="height: 150px; overflow: hidden; border-radius: 4px; margin-bottom: 10px;">
                            <img src="images/${imageName}" alt="${cat.typeLabel}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <h3>${cat.typeLabel}</h3>
                        <p>${cat.typeDescr}</p>
                        <p><strong>Average Rental Rate:</strong> $${cat.service_rate} / day</p>
                    `;
                    elements.containers.categoriesGrid.appendChild(card);
                });
            }
        } catch (err) {
            elements.containers.categoriesGrid.innerHTML = `<p class="message error">${err.message}</p>`;
        }
    }

    // Admin Login Feature
    elements.forms.adminLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = elements.inputs.adminEmail.value;
        const password = elements.inputs.adminPassword.value;
        elements.containers.adminLoginMessage.textContent = '';
        
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (data.success) {
                state.adminLoggedIn = true;
                elements.containers.adminLoginMessage.textContent = '';
                showSection(elements.sections.adminFleet);
                loadAdminFleet();
            } else {
                elements.containers.adminLoginMessage.textContent = data.message || 'Login failed';
                elements.containers.adminLoginMessage.className = 'message error';
            }
        } catch (err) {
            elements.containers.adminLoginMessage.textContent = 'Server error during login.';
            elements.containers.adminLoginMessage.className = 'message error';
        }
    });

    // Admin Fleet Feature (Return Phase)
    async function loadAdminFleet() {
        elements.containers.fleetList.innerHTML = 'Loading fleet data...';
        try {
            const [pendingRes, rentedRes] = await Promise.all([
                fetch('/api/admin/pending-pickups'),
                fetch('/api/admin/rented-cars')
            ]);

            if (!pendingRes.ok || !rentedRes.ok) throw new Error('Failed to load fleet data');
            const pendingData = await pendingRes.json();
            const rentedData = await rentedRes.json();
            
            elements.containers.fleetList.innerHTML = '';

            // Render Pending Pickups
            const pendingHeader = document.createElement('h2');
            pendingHeader.textContent = 'Pending Pickups';
            elements.containers.fleetList.appendChild(pendingHeader);

            if (pendingData.length === 0) {
                elements.containers.fleetList.innerHTML += '<p>No pending pickups.</p>';
            } else {
                const pendingContainer = document.createElement('div');
                pendingContainer.style.display = 'grid';
                pendingContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
                pendingContainer.style.gap = '20px';
                pendingContainer.style.marginBottom = '20px';

                pendingData.forEach(car => {
                    const card = document.createElement('div');
                    card.className = 'car-card';
                    card.style.borderLeft = '5px solid #28a745';
                    card.innerHTML = `
                        <h3>${car.brand} ${car.model}</h3>
                        <p><strong>Car_ID:</strong> ${car.car_id}</p>
                        <p><strong>Pickup Date:</strong> ${new Date(car.pickupDate).toLocaleDateString()}</p>
                        <p><strong>Return Date:</strong> ${new Date(car.returnDate).toLocaleDateString()}</p>
                        <hr style="margin: 10px 0;">
                        <button class="pickup-btn" data-car-id="${car.car_id}" data-status-id="${car.status_id}" style="width: 100%; background-color: #28a745; color: white; padding: 10px; border: none; border-radius: 4px; cursor: pointer;">Confirm Pickup</button>
                    `;
                    pendingContainer.appendChild(card);
                });
                elements.containers.fleetList.appendChild(pendingContainer);
            }

            // Render Active Rentals (Returns)
            const returnHeader = document.createElement('h2');
            returnHeader.textContent = 'Active Rentals (Awaiting Return)';
            returnHeader.style.marginTop = '30px';
            elements.containers.fleetList.appendChild(returnHeader);

            if (rentedData.length === 0) {
                elements.containers.fleetList.innerHTML += '<p>No cars currently rented.</p>';
            } else {
                const rentedContainer = document.createElement('div');
                rentedContainer.style.display = 'grid';
                rentedContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
                rentedContainer.style.gap = '20px';

                rentedData.forEach(car => {
                    const card = document.createElement('div');
                    card.className = 'car-card';
                    card.style.borderLeft = '5px solid #dc3545';
                    card.innerHTML = `
                        <h3>${car.brand} ${car.model}</h3>
                        <p><strong>Car_ID:</strong> ${car.car_id}</p>
                        <p><strong>Status:</strong> <span style="color: red; font-weight: bold;">${car.car_status}</span></p>
                        <hr style="margin: 10px 0;">
                        <div class="form-group" style="text-align: left;">
                            <label>Return Condition:</label>
                            <select id="condition-${car.car_id}" style="width: 100%; margin-bottom: 10px;">
                                <option value="clean">Clean (Make Available)</option>
                                <option value="scratched">Scratched (Make Not Ready)</option>
                                <option value="damaged">Damaged (Make Not Ready)</option>
                                <option value="dirty">Dirty (Make Not Ready)</option>
                            </select>
                            <button class="return-btn" data-car-id="${car.car_id}" data-status-id="${car.status_id}" style="width: 100%;">Process Return</button>
                        </div>
                    `;
                    rentedContainer.appendChild(card);
                });
                elements.containers.fleetList.appendChild(rentedContainer);
            }

            // Add Event Listeners for Pickups
            document.querySelectorAll('.pickup-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const carId = e.target.getAttribute('data-car-id');
                    const statusId = e.target.getAttribute('data-status-id');
                    try {
                        const pickupRes = await fetch('/api/admin/pickup', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ car_id: carId, status_id: statusId })
                        });
                        const data = await pickupRes.json();
                        if (data.success) {
                            alert(data.message);
                            loadAdminFleet();
                        } else {
                            alert('Error: ' + data.error);
                        }
                    } catch (err) {
                        alert('Network error while processing pickup.');
                    }
                });
            });

            // Add Event Listeners for Returns
            document.querySelectorAll('.return-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const carId = e.target.getAttribute('data-car-id');
                    const statusId = e.target.getAttribute('data-status-id');
                    const conditionSelect = document.getElementById(`condition-${carId}`);
                    const condition = conditionSelect.value;
                    
                    try {
                        const returnRes = await fetch('/api/admin/return', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ car_id: carId, status_id: statusId, car_condition: condition })
                        });
                        const returnData = await returnRes.json();
                        
                        if (returnRes.ok && returnData.success) {
                            alert(returnData.message);
                            loadAdminFleet(); // Reload list
                        } else {
                            alert('Error: ' + returnData.error);
                        }
                    } catch (err) {
                        alert('Network error while processing return.');
                    }
                });
            });

        } catch (err) {
            elements.containers.fleetList.innerHTML = `<p class="message error">${err.message}</p>`;
        }
    }

    // --- End New Features Logic ---

    // Dashboard Feature
    async function loadDashboard() {
        elements.containers.dashboardGrid.innerHTML = 'Loading...';
        try {
            const res = await fetch('/api/dashboard');
            if (!res.ok) throw new Error('Failed to load dashboard');
            const data = await res.json();
            
            elements.containers.dashboardGrid.innerHTML = '';
            if (data.length === 0) {
                elements.containers.dashboardGrid.innerHTML = '<p>No locations found.</p>';
            } else {
                data.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'dashboard-card';
                    card.innerHTML = `
                        <h3>${item.city} - ${item.address}</h3>
                        <p>Available Cars</p>
                        <p class="count">${item.available_count}</p>
                    `;
                    elements.containers.dashboardGrid.appendChild(card);
                });
            }
        } catch (err) {
            elements.containers.dashboardGrid.innerHTML = `<p class="message error">${err.message}</p>`;
        }
    }

    // Profile Feature
    elements.forms.profileSearch.addEventListener('submit', async (e) => {
        e.preventDefault();
        elements.containers.profileError.textContent = '';
        elements.containers.profileError.className = 'message';
        elements.containers.profileDetails.classList.add('hidden');

        const tdl = elements.inputs.profileTdl.value;
        try {
            const res = await fetch(`/api/profile/${tdl}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Profile not found.');
            }

            // Populate personal details
            document.getElementById('prof-name').textContent = `${data.customer.firstname} ${data.customer.lastname}`;
            document.getElementById('prof-phone').textContent = data.customer.phone;
            document.getElementById('prof-email').textContent = data.customer.email;
            document.getElementById('prof-city').textContent = data.customer.city;

            // Populate history
            elements.containers.bookingHistory.innerHTML = '';
            if (data.history.length === 0) {
                elements.containers.bookingHistory.innerHTML = '<p>No previous bookings found.</p>';
            } else {
                data.history.forEach(item => {
                    const card = document.createElement('div');
                    card.className = `history-card ${item.car_condition.toLowerCase() === 'pending' ? 'pending' : ''}`;
                    card.innerHTML = `
                        <p><strong>Reservation ID:</strong> ${item.reservation_id}</p>
                        <p><strong>Car:</strong> ${item.brand} ${item.model}</p>
                        <p><strong>Dates:</strong> ${new Date(item.pickupDate).toLocaleDateString()} to ${new Date(item.returnDate).toLocaleDateString()}</p>
                        <p><strong>Amount:</strong> $${item.amount}</p>
                        <p><strong>Status:</strong> ${item.car_condition}</p>
                    `;
                    elements.containers.bookingHistory.appendChild(card);
                });
            }

            elements.containers.profileDetails.classList.remove('hidden');

        } catch (err) {
            elements.containers.profileError.textContent = err.message;
            elements.containers.profileError.className = 'message error';
        }
    });

    // Renting Event Listeners
    elements.forms.search.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        elements.containers.searchMessage.textContent = '';
        elements.containers.searchMessage.className = 'message';

        const pickupDate = new Date(elements.inputs.pickupDate.value);
        const returnDate = new Date(elements.inputs.returnDate.value);

        if (pickupDate >= returnDate) {
            elements.containers.searchMessage.textContent = 'Return date must be strictly after pickup date.';
            elements.containers.searchMessage.className = 'message error';
            return;
        }

        state.searchParams = {
            pickupLocationId: elements.inputs.pickupLoc.value,
            returnLocationId: elements.inputs.returnLoc.value,
            pickupDate: elements.inputs.pickupDate.value,
            returnDate: elements.inputs.returnDate.value
        };

        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state.searchParams)
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Server error occurred.');
            }

            if (data.cars && data.cars.length > 0) {
                renderCars(data.cars);
                showSection(elements.sections.cars);
            } else {
                elements.containers.searchMessage.textContent = data.message || "Sorry, there's no car available at your location and time.";
                elements.containers.searchMessage.className = 'message info';
            }
        } catch (err) {
            elements.containers.searchMessage.textContent = err.message || 'A server error occurred while searching.';
            elements.containers.searchMessage.className = 'message error';
        }
    });

    elements.forms.payment.addEventListener('submit', async (e) => {
        e.preventDefault();
        elements.containers.paymentMessage.textContent = '';

        const payload = {
            ...state.searchParams,
            carId: state.selectedCar,
            customer: {
                firstname: document.getElementById('fname').value,
                lastname: document.getElementById('lname').value,
                TDL_ID: document.getElementById('tdl').value,
                phone: document.getElementById('phone').value,
                city: document.getElementById('city').value,
                email: document.getElementById('email').value
            }
        };

        try {
            const res = await fetch('/api/reserve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                if (data.message === 'payment successfully') {
                    showSection(elements.sections.success);
                }
            } else {
                const errorData = await res.json();
                elements.containers.paymentMessage.textContent = errorData.error || 'Payment failed.';
                elements.containers.paymentMessage.className = 'message error';
            }
        } catch (err) {
            elements.containers.paymentMessage.textContent = 'An error occurred connecting to the server.';
            elements.containers.paymentMessage.className = 'message error';
        }
    });

    function renderCars(cars) {
        elements.containers.carsList.innerHTML = '';
        cars.forEach(car => {
            const card = document.createElement('div');
            card.className = 'car-card';
            card.innerHTML = `
                <div class="car-placeholder">
                    <span>No Image Available</span>
                </div>
                <h3>${car.brand || 'Brand'} ${car.model || 'Model'}</h3>
                <p><strong>Type:</strong> ${car.type_name || 'Standard'}</p>
                <p><strong>Price:</strong> $${car.price_per_day || '0.00'} / day</p>
                <button type="button" data-id="${car.car_id}" class="select-car-btn">Select Car</button>
            `;
            elements.containers.carsList.appendChild(card);
        });

        document.querySelectorAll('.select-car-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                state.selectedCar = e.target.getAttribute('data-id');
                showSection(elements.sections.payment);
            });
        });
    }

    elements.buttons.backToSearch.addEventListener('click', () => {
        showSection(elements.sections.search);
    });

    elements.buttons.cancelPayment.addEventListener('click', () => {
        showSection(elements.sections.cars);
    });

    elements.buttons.viewHistory.addEventListener('click', () => {
        // Go to profile tab and prepopulate TDL if known
        const tdlField = document.getElementById('tdl');
        if(tdlField && tdlField.value) {
            elements.inputs.profileTdl.value = tdlField.value;
            // auto submit
            elements.buttons.navProfile.click();
            elements.forms.profileSearch.dispatchEvent(new Event('submit'));
        } else {
            location.reload(); 
        }
    });
});
