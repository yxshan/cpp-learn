#include <iostream>
#include <string>
#include <variant>

int main() {
    std::variant<int, std::string> value = 42;

    if (const int* number = std::get_if<int>(&value)) {
        std::cout << "value=" << *number << '\n';
    }

    try {
        static_cast<void>(std::get<std::string>(value));
    } catch (const std::bad_variant_access&) {
        std::cout << "wrong alternative\n";
    }
}
