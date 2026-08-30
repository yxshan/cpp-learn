#include <iostream>
#include <memory>

int main() {
    const auto owner = std::make_shared<int>(42);
    const std::weak_ptr<int> observer = owner;
    const auto locked = observer.lock();

    std::cout << std::boolalpha << "locked=" << static_cast<bool>(locked) << '\n';
    std::cout << "value=" << *locked << '\n';
    std::cout << "owners=" << owner.use_count() << '\n';
}
