class LocationDetector {
    constructor() {
        this.isLocal = null;
        this.source = null;
        this.listeners = [];
    }

    detectLocalBrowser() {
        const userAgent = navigator.userAgent.toLowerCase();
        const hasFirefoxUA = userAgent.includes('firefox') && !userAgent.includes('seamonkey');
        
        let isRealFirefox = hasFirefoxUA;
        
        if (!isRealFirefox) {
            const div = document.createElement('div');
            div.style.cssText = 'position: absolute; top: -100px; left: -100px; width: 10px; height: 10px;';
            document.body.appendChild(div);
            
            try {
                div.style.animationName = 'none';
                div.style.animationDuration = '0.001s';
                
                const computedStyle = window.getComputedStyle(div);
                const hasMozPrefix = computedStyle.MozAnimationName !== undefined;
                
                if (hasMozPrefix) {
                    isRealFirefox = true;
                }
            } catch (e) {
                isRealFirefox = false;
            }
            
            document.body.removeChild(div);
        }
        
        if (isRealFirefox) {
            this.isLocal = false;
            this.source = 'browser';
            return false;
        } else {
            this.isLocal = true;
            this.source = 'browser';
            return true;
        }
    }

    detectByPosition(data) {
        if (data && data.region) {
            this.isLocal = data.region === 'local';
            this.source = 'network';
            this.notifyListeners();
            return this.isLocal;
        }
        return null;
    }

    getStatus() {
        return this.isLocal === true;
    }

    getSource() {
        return this.source;
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => callback(this.isLocal, this.source));
    }

    setManual(value) {
        this.isLocal = value;
        this.source = 'manual';
        this.notifyListeners();
    }
}

export default LocationDetector;