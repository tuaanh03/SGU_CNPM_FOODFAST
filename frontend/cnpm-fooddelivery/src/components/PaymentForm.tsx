import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

const PaymentForm = () => {
	const paymentMethods = [
		{
			id: "credit",
			name: "Thẻ tín dụng/ghi nợ",
			icon: "💳",
			description: "Visa, MasterCard, JCB",
			isPopular: true,
		},
		{
			id: "momo",
			name: "Ví MoMo",
			icon: "📱",
			description: "Thanh toán qua ví MoMo",
			isPopular: false,
		},
		{
			id: "zalopay",
			name: "ZaloPay",
			icon: "💰",
			description: "Thanh toán qua ví ZaloPay",
			isPopular: false,
		},
		{
			id: "banking",
			name: "Internet Banking",
			icon: "🏦",
			description: "Chuyển khoản trực tuyến",
			isPopular: false,
		},
		{
			id: "cash",
			name: "Thanh toán khi nhận hàng",
			icon: "💵",
			description: "Thanh toán bằng tiền mặt",
			isPopular: true,
		},
	];

	return (
		<Card className="mb-6">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					💳 Chọn Phương Thức Thanh Toán
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{paymentMethods.map((method) => (
						<div
							key={method.id}
							className="p-4 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors cursor-pointer"
						>
							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="radio"
									name="paymentMethod"
									value={method.id}
									defaultChecked={method.id === "credit"}
									className="text-orange-500"
								/>
								<div className="flex items-center gap-3 flex-1">
									<span className="text-2xl">{method.icon}</span>
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<h4 className="font-medium text-gray-800">
												{method.name}
											</h4>
											{method.isPopular && (
												<Badge className="bg-orange-100 text-orange-700 text-xs">
													Phổ biến
												</Badge>
											)}
										</div>
										<p className="text-sm text-gray-600 mt-1">
											{method.description}
										</p>
									</div>
								</div>
							</label>
						</div>
					))}
				</div>

				{/* Credit Card Form */}
				<div className="mt-6 p-4 bg-gray-50 rounded-lg">
					<h4 className="font-medium text-gray-800 mb-4">Thông tin thẻ</h4>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="md:col-span-2">
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Số thẻ
							</label>
							<input
								type="text"
								placeholder="1234 5678 9012 3456"
								className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Ngày hết hạn
							</label>
							<input
								type="text"
								placeholder="MM/YY"
								className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								CVV
							</label>
							<input
								type="text"
								placeholder="123"
								className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
							/>
						</div>
						<div className="md:col-span-2">
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Tên chủ thẻ
							</label>
							<input
								type="text"
								placeholder="NGUYEN VAN A"
								className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
							/>
						</div>
					</div>
				</div>

				{/* Security Note */}
				<div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
					<div className="flex items-center gap-2">
						<span className="text-blue-600">🔒</span>
						<p className="text-sm text-blue-700">
							Thông tin thẻ của bạn được mã hóa và bảo mật tuyệt đối
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export default PaymentForm;

