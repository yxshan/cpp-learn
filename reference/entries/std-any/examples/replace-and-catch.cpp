#include <any>
#include <iostream>
#include <string>

int main() {
    std::any value;
    value.emplace<std::string>("ready");
    std::cout << "value=" << std::any_cast<const std::string&>(value) << '\n';

    try {
        static_cast<void>(std::any_cast<int>(value));
    } catch (const std::bad_any_cast&) {
        std::cout << "bad cast\n";
    }

    value.reset();
    std::cout << std::boolalpha << "has_value=" << value.has_value() << '\n';
}
