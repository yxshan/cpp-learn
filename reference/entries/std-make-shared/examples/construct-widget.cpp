#include <iostream>
#include <memory>

struct Widget {
    explicit Widget(int initial_value) : value{initial_value} {}

    int value{};
};

int main() {
    const auto widget = std::make_shared<Widget>(42);
    std::cout << "value=" << widget->value << '\n';
    std::cout << "owners=" << widget.use_count() << '\n';
}
