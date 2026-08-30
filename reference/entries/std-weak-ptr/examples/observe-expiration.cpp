#include <iostream>
#include <memory>

int main() {
    std::weak_ptr<int> observer;
    {
        const auto owner = std::make_shared<int>(42);
        observer = owner;
        std::cout << std::boolalpha << "expired=" << observer.expired() << '\n';
    }

    std::cout << "expired=" << observer.expired() << '\n';
    std::cout << "locked=" << static_cast<bool>(observer.lock()) << '\n';
}
