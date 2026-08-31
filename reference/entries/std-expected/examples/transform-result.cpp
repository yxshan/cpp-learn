#include <expected>
#include <iostream>
#include <string>

int main() {
    auto answer = std::expected<int, std::string>{21}.transform(
        [](int value) { return value * 2; });
    auto failure = std::expected<int, std::string>{
        std::unexpected(std::string{"invalid"})};
    auto unchanged = failure.transform([](int value) { return value * 2; });

    std::cout << "answer=" << answer.value() << '\n';
    std::cout << "error=" << unchanged.error() << '\n';
}
